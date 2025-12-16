"""
Vercel Serverless Function
楽天ページ取得プロキシ（CORS回避用）

注意: 商用利用では、楽天の利用規約を確認してください
"""

import json
import urllib.parse
from urllib.parse import urlparse
import requests

def handler(req):
    """Vercel Functions Pythonハンドラー"""
    try:
        # リクエストメソッドを取得
        method = req.get('method', 'GET')
        
        # OPTIONSリクエストの処理（CORS用）
        if method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            }
        
        # GETリクエストのみ許可
        if method != 'GET':
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Method not allowed'})
            }
        
        # クエリパラメータを取得
        query_params = req.get('queryStringParameters') or {}
        url = query_params.get('url')
            
        # バリデーション
        if not url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'URLパラメータが必要です'})
            }
            
            # 楽天のドメインのみ許可（セキュリティ対策）
            allowed_domains = [
                'rakuten.co.jp',
                'item.rakuten.co.jp',
                'review.rakuten.co.jp'
            ]
            
        try:
            url_obj = urlparse(url)
        except Exception as url_error:
            print(f'❌ URL解析エラー: {url_error}')
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': '無効なURL形式です',
                    'message': str(url_error),
                    'url': url
                })
            }
        
        # 楽天のドメインのみ許可（セキュリティ対策）
        allowed_domains = [
            'rakuten.co.jp',
            'item.rakuten.co.jp',
            'review.rakuten.co.jp'
        ]
        
        is_allowed = any(url_obj.hostname.endswith(domain) for domain in allowed_domains)
        
        if not is_allowed:
            return {
                'statusCode': 403,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': '許可されていないドメインです',
                    'allowedDomains': allowed_domains,
                    'hostname': url_obj.hostname
                })
            }
            
        # 楽天のページを取得
        print(f'🌐 楽天ページ取得: {url}')
        print(f'🌐 URLオブジェクト: {url_obj.hostname}, {url_obj.path}')
        
        # タイムアウトを25秒に設定（VercelのmaxDurationが60秒なので余裕を持たせる）
        timeout_seconds = 25
        
        try:
            # HTTPリクエストを送信
            print(f'🚀 HTTPリクエスト送信開始: {url}')
            import time
            start_time = time.time()
            
            response = requests.get(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                    'Referer': 'https://www.rakuten.co.jp/'
                },
                timeout=timeout_seconds,
                allow_redirects=True
            )
            
            end_time = time.time()
            print(f'✅ HTTPリクエスト完了 ({int((end_time - start_time) * 1000)}ms): {response.url}')
            
            # レスポンス情報をログに出力
            print(f'📥 楽天サーバーからのレスポンス:')
            print(f'Status: {response.status_code} {response.reason}')
            print(f'URL: {response.url}')
            print(f'Headers: {dict(response.headers)}')
            
            if not response.ok:
                error_text = response.text[:500] if response.text else 'エラーレスポンスの取得に失敗'
                print(f'❌ 楽天サーバーエラー ({response.status_code}): {error_text}')
                print(f'エラーレスポンス全文: {response.text}')
                raise Exception(f'HTTPエラー: {response.status_code} {response.reason}')
            
            html = response.text
            
            # ログ出力
            print(f'📄 楽天サーバーからのレスポンス:')
            print(f'HTML長: {len(html)} 文字')
            print(f'Content-Type: {response.headers.get("content-type", "N/A")}')
            print(f'Content-Length: {response.headers.get("content-length", "N/A")}')
            print(f'Status: {response.status_code} {response.reason}')
            
            # HTMLが短すぎる場合はエラー
            if len(html) < 100:
                print(f'❌ HTMLが短すぎます: {html}')
                print(f'HTML内容（全文）: {html}')
                print(f'レスポンスURL: {response.url}')
                print(f'ステータスコード: {response.status_code}')
                
                # Vercelのエラーレファレンスの可能性を確認
                if 'Reference' in html and '#' in html:
                    print('❌ Vercelのエラーレファレンスが返されました。これはVercel Functionsの内部エラーです。')
                
                raise Exception(f'HTMLが短すぎます ({len(html)}文字): {html[:100]}')
            
            # HTMLの最初と最後をログに出力
            print(f'HTML（最初の500文字）: {html[:500]}')
            print(f'HTML（最後の500文字）: {html[-500:]}')
            
            # HTML全文をログに出力（デバッグ用）
            print('=' * 80)
            print('📄 HTML全文:')
            print(html)
            print('=' * 80)
            
            # HTMLを返す
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': html
            }
            
        except requests.exceptions.Timeout:
            print('❌ リクエストがタイムアウトしました')
            return {
                'statusCode': 504,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'タイムアウト: サーバーからの応答が遅すぎます'
                })
            }
            
        except requests.exceptions.RequestException as fetch_error:
            print(f'❌ Fetchエラー発生: {fetch_error}')
            print(f'エラー詳細: {type(fetch_error).__name__}, {str(fetch_error)}')
            raise fetch_error
            
    except Exception as error:
        print(f'❌ エラー: {error}')
        print(f'❌ エラー詳細: {type(error).__name__}, {str(error)}')
        
        # タイムアウトエラーの場合
        if isinstance(error, requests.exceptions.Timeout):
            return {
                'statusCode': 504,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'タイムアウト: サーバーからの応答が遅すぎます',
                    'message': str(error)
                })
            }
        
        # URL関連のエラーの場合
        if 'Invalid URL' in str(error) or 'URL' in str(error):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': '無効なURLです',
                    'message': str(error)
                })
            }
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'サーバーエラーが発生しました',
                'message': str(error),
                'name': type(error).__name__
            })
        }

