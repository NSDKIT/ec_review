"""
Vercel Serverless Function (Python)
楽天市場の検索結果ページから商品情報をスクレイピング
Google Spreadsheetへの書き込み機能も含む
"""

import os
import json
import re
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import requests

# Google Sheets API用（オプション）
try:
    import gspread
    from google.oauth2.service_account import Credentials
    GSPREAD_AVAILABLE = True
except ImportError:
    GSPREAD_AVAILABLE = False


def extract_product_info(html_content: str) -> List[Dict]:
    """
    HTMLコンテンツから商品情報を抽出する
    
    Args:
        html_content: HTMLコンテンツの文字列
        
    Returns:
        商品情報のリスト
    """
    soup = BeautifulSoup(html_content, "html.parser")
    products = []
    
    # 方法1: 商品画像を基準に商品コンテナを探す
    # 楽天市場の商品画像は通常、tshop.r10s.jpドメインを使用
    product_images = soup.find_all("img", src=re.compile(r'tshop\.r10s\.jp.*\.(jpg|jpeg|png)', re.I))
    
    processed_containers = set()
    
    for img in product_images:
        # 商品コンテナを取得（画像の親要素から探索）
        container = None
        
        # 親要素を探索（最大5階層まで）
        parent = img.parent
        for _ in range(5):
            if parent is None:
                break
            if parent.name == 'div' and (
                any('item' in str(cls).lower() for cls in parent.get('class', [])) or
                any('product' in str(cls).lower() for cls in parent.get('class', [])) or
                any('goods' in str(cls).lower() for cls in parent.get('class', []))
            ):
                container = parent
                break
            parent = parent.parent
        
        # コンテナが見つからない場合は、画像の親要素を使用
        if container is None:
            container = img.find_parent("div")
        
        if container is None:
            continue
        
        # 同じコンテナを重複処理しないようにする
        container_id = id(container)
        if container_id in processed_containers:
            continue
        processed_containers.add(container_id)
        
        product = {
            "name": "",
            "price": "",
            "image_url": img.get("src", ""),
            "image_alt": img.get("alt", ""),
            "product_url": "",
            "review_rating": "",
            "review_count": "",
            "shop_name": "",
            "shipping_info": "",
            "shipping_price": "",
            "point_info": "",
            "additional_info": {}
        }
        
        # 商品名を取得
        # 優先順位: h2/h3内のaタグ > itemを含むhrefのaタグ > title属性
        name_link = None
        for selector in [
            container.find("h2"),
            container.find("h3"),
            container.find("a", href=re.compile(r'/item/')),
            container.find("a", title=True)
        ]:
            if selector:
                if selector.name == 'h2' or selector.name == 'h3':
                    name_link = selector.find("a")
                else:
                    name_link = selector
                if name_link:
                    break
        
        if name_link:
            product["name"] = name_link.get_text(strip=True)
            href = name_link.get("href", "")
            if href:
                # 相対URLを絶対URLに変換
                if href.startswith("//"):
                    product["product_url"] = "https:" + href
                elif href.startswith("/"):
                    product["product_url"] = "https://search.rakuten.co.jp" + href
                else:
                    product["product_url"] = href
        
        # 商品名が取得できなかった場合は、画像のalt属性から取得
        if not product["name"] and product["image_alt"]:
            alt_text = product["image_alt"]
            if len(alt_text) > 100:
                product["name"] = alt_text[:100] + "..."
            else:
                product["name"] = alt_text
        
        # 価格を取得
        # まず、価格専用のクラスを持つ要素を探す（商品名要素は除外）
        price_elements = container.find_all(class_=re.compile(r'price', re.I))
        for price_elem in price_elements:
            # 商品名を含む要素は除外
            if price_elem.find_parent("h2") or price_elem.find_parent("h3"):
                continue
            if price_elem.find("a", href=re.compile(r'/item/')):
                continue
            
            price_text = price_elem.get_text(strip=True)
            # 価格パターン: 数値+円 または ¥+数値 の形式で、短いテキストのみ
            price_match = re.search(r'([\d,]+円|¥[\d,]+|[\d,]+円/本)', price_text)
            if price_match and len(price_text) < 100:
                product["price"] = price_match.group(1)
                break
        
        # 価格要素が見つからない場合、テキストノードから価格パターンを探す
        if not product["price"]:
            price_pattern = re.compile(r'([\d,]+円|¥[\d,]+|[\d,]+円/本)')
            
            for text_node in container.find_all(string=price_pattern):
                parent = text_node.parent
                if parent:
                    if parent.name in ['h2', 'h3']:
                        continue
                    if parent.find("a", href=re.compile(r'/item/')):
                        continue
                    if parent.find_parent("h2") or parent.find_parent("h3"):
                        continue
                
                price_text = text_node.strip()
                if len(price_text) < 100:
                    match = price_pattern.search(price_text)
                    if match:
                        product["price"] = match.group(1)
                        break
                    elif re.match(r'^[\d,]+円(/本)?\s*\(.*\)?$', price_text):
                        product["price"] = price_text
                        break
        
        # レビュー情報を取得
        review_text_nodes = container.find_all(string=re.compile(r'\d+\.\d+\([\d,]+件\)'))
        if review_text_nodes:
            review_text = review_text_nodes[0].strip()
            match = re.match(r'(\d+\.\d+)\(([\d,]+)件\)', review_text)
            if match:
                product["review_rating"] = match.group(1)
                product["review_count"] = match.group(2)
            else:
                product["review_rating"] = review_text
        
        # レビューリンクからも取得を試みる
        if not product["review_rating"]:
            review_link = container.find("a", href=re.compile(r'review\.rakuten\.co\.jp/item'))
            if review_link:
                review_text = review_link.get_text(strip=True)
                match = re.match(r'(\d+\.\d+)\(([\d,]+)件\)', review_text)
                if match:
                    product["review_rating"] = match.group(1)
                    product["review_count"] = match.group(2)
        
        # ショップ名を画像URLから抽出
        shop_match = re.search(r'tshop\.r10s\.jp/([^/]+)/', product["image_url"])
        if shop_match:
            product["shop_name"] = shop_match.group(1)
        
        # ショップリンクからも取得を試みる
        if not product["shop_name"]:
            shop_link = container.find("a", href=re.compile(r'/shop/'))
            if shop_link:
                product["shop_name"] = shop_link.get_text(strip=True)
        
        # 送料情報を取得
        shipping_price_patterns = [
            r'送料\s*([\d,]+円)',
            r'送料\s*\+?\s*([\d,]+円)',
            r'送料[：:]\s*([\d,]+円)',
            r'\+送料\s*([\d,]+円)',
        ]
        
        found_shipping_price = False
        for pattern in shipping_price_patterns:
            matches = re.finditer(pattern, container.get_text())
            for match in matches:
                full_text = match.group(0)
                price = match.group(1) if match.groups() else ""
                
                if (len(full_text) < 50 and 
                    "送料" in full_text and 
                    "円" in full_text and
                    "送料無料" not in full_text and
                    price):
                    product["shipping_price"] = price
                    product["shipping_info"] = "送料有料"
                    found_shipping_price = True
                    break
            
            if found_shipping_price:
                break
        
        # 送料金額が見つからなかった場合、送料無料/有料の判定のみ
        if not found_shipping_price:
            shipping_text_nodes = container.find_all(string=re.compile(r'送料無料|送料有料'))
            for shipping_node in shipping_text_nodes:
                shipping_text = shipping_node.strip()
                if len(shipping_text) < 50 and re.match(r'^送料(無料|有料)', shipping_text):
                    product["shipping_info"] = shipping_text
                    break
        
        # ポイント情報を取得
        point_text_nodes = container.find_all(string=re.compile(r'ポイント|pt|PT'))
        if point_text_nodes:
            point_text = point_text_nodes[0].strip()
            if len(point_text) < 50:
                product["point_info"] = point_text
        
        # 商品名が取得できた場合のみリストに追加
        if product["name"]:
            products.append(product)
    
    return products


def fetch_rakuten_products(keyword: str, page: int = 1, max_items: int = 30) -> List[Dict]:
    """
    楽天市場の検索結果から商品情報を取得する
    
    Args:
        keyword: 検索キーワード
        page: ページ番号（1から開始）
        max_items: 最大取得数
        
    Returns:
        商品情報のリスト
    """
    url = f"https://search.rakuten.co.jp/search/mall/{keyword}/?p={page}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://www.rakuten.co.jp/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        products = extract_product_info(response.text)
        return products[:max_items]
    except requests.RequestException as e:
        print(f"エラーが発生しました: {e}")
        return []


def write_products_to_sheet(spreadsheet_id: str, products: List[Dict]) -> Dict:
    """
    商品情報をGoogle Spreadsheetに書き込む
    
    Args:
        spreadsheet_id: スプレッドシートID
        products: 商品情報のリスト
        
    Returns:
        書き込み結果
    """
    if not GSPREAD_AVAILABLE:
        return {
            "success": False,
            "error": "gspreadライブラリがインストールされていません"
        }
    
    try:
        # Google Sheets API認証情報を環境変数から取得
        creds_json = os.getenv('GOOGLE_SHEETS_CREDENTIALS')
        if not creds_json:
            return {
                "success": False,
                "error": "GOOGLE_SHEETS_CREDENTIALS環境変数が設定されていません"
            }
        
        # 認証情報をパース
        creds_dict = json.loads(creds_json)
        creds = Credentials.from_service_account_info(
            creds_dict,
            scopes=['https://www.googleapis.com/auth/spreadsheets']
        )
        
        # スプレッドシートを開く
        gc = gspread.authorize(creds)
        ss = gc.open_by_key(spreadsheet_id)
        sheet = ss.sheet1
        
        # 既存のデータをクリア（B2:O300）
        sheet.batch_clear(['B2:O300'])
        
        # ヘッダーを書き込み
        headers = [
            '検索順位',
            '商品名',
            '価格(送料抜)',
            '価格(送料込)',
            '商品URL',
            'サムネURL',
            'レビュー数',
            'レビュー平均',
            'レビュー最新日',
            '直近3ヶ月のレビュー数',
            '直近3ヶ月のレビュー平均',
            '高評価レビュー',
            '中評価レビュー',
            '低評価レビュー'
        ]
        sheet.update('B1:O1', [headers])
        
        # 商品データを書き込み
        row_data = []
        for i, product in enumerate(products):
            # 価格から数値を抽出
            price_match = re.search(r'[\d,]+', product.get('price', ''))
            item_price = int(price_match.group(0).replace(',', '')) if price_match else 0
            
            # 送料価格を抽出
            shipping_price = 0
            if product.get('shipping_price'):
                shipping_match = re.search(r'[\d,]+', product['shipping_price'])
                shipping_price = int(shipping_match.group(0).replace(',', '')) if shipping_match else 0
            
            # 送料込み価格を計算
            total_price = item_price
            if product.get('shipping_info') == '送料有料' and shipping_price > 0:
                total_price = item_price + shipping_price
            elif product.get('shipping_info') == '送料無料':
                total_price = item_price
            
            # レビュー数を数値に変換
            review_count = int(product.get('review_count', '0').replace(',', '')) if product.get('review_count') else 0
            
            # レビュー平均を数値に変換
            review_average = float(product.get('review_rating', '0')) if product.get('review_rating') else 0.0
            
            row = [
                i + 1,  # 検索順位
                product.get('name', ''),
                item_price,  # 価格(送料抜)
                total_price,  # 価格(送料込)
                product.get('product_url', ''),
                product.get('image_url', ''),
                review_count,  # レビュー数
                review_average,  # レビュー平均
                '',  # レビュー最新日（後で更新）
                '',  # 直近3ヶ月のレビュー数（後で更新）
                '',  # 直近3ヶ月のレビュー平均（後で更新）
                '',  # 高評価レビュー（後で更新）
                '',  # 中評価レビュー（後で更新）
                ''   # 低評価レビュー（後で更新）
            ]
            row_data.append(row)
        
        # 一括書き込み
        if row_data:
            sheet.update(f'B2:O{len(row_data) + 1}', row_data)
        
        return {
            "success": True,
            "message": f"{len(row_data)}件の商品データを書き込みました",
            "totalProducts": len(row_data)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "書き込みに失敗しました"
        }


import json
import urllib.parse
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    """
    Vercel Serverless Function ハンドラー
    """
    def do_OPTIONS(self):
        """OPTIONSリクエストの処理（CORS用）"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """GETリクエストの処理"""
        self.handle_request()
    
    def do_POST(self):
        """POSTリクエストの処理"""
        self.handle_request()
    
    def handle_request(self):
        try:
            # CORS設定
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            
            # クエリパラメータを取得
            parsed_url = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            
            # リクエストボディを取得（POSTの場合）
            body = {}
            if self.command == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = json.loads(self.rfile.read(content_length).decode('utf-8'))
            
            # パラメータを取得（ボディ優先、次にクエリパラメータ）
            keyword = body.get('keyword') or (query_params.get('keyword', [None])[0])
            page = int(body.get('page') or query_params.get('page', ['1'])[0])
            max_items = int(body.get('maxItems') or query_params.get('maxItems', ['30'])[0])
            spreadsheet_id = body.get('spreadsheetId') or query_params.get('spreadsheetId', [None])[0]
        
            # バリデーション
            if not keyword:
                response_data = {
                    'success': False,
                    'error': '検索キーワードが必要です'
                }
                self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
                return
            
            # 楽天市場の検索結果から商品情報を取得
            products = fetch_rakuten_products(keyword, page, max_items)
            
            # 商品が見つからない場合
            if not products:
                response_data = {
                    'success': True,
                    'total_products': 0,
                    'products': [],
                    'debug': {
                        'keyword': keyword,
                        'page': page,
                        'maxItems': max_items,
                        'message': '商品が見つかりませんでした。'
                    }
                }
                self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
                return
            
            # スプレッドシートIDが指定されている場合は書き込みも実行
            write_result = None
            if spreadsheet_id:
                write_result = write_products_to_sheet(spreadsheet_id, products)
            
            # レスポンスを返す
            response_data = {
                'success': True,
                'total_products': len(products),
                'products': products
            }
            
            if write_result:
                response_data['writeResult'] = write_result
            
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            response_data = {
                'success': False,
                'error': '予期せぬエラーが発生しました',
                'message': str(e)
            }
            self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))

