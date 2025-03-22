from yt_dlp import YoutubeDL
import sys
import os
import traceback

def download_video(url, output_dir):
    try:
        print(f"[DEBUG] Starting download for URL: {url}")
        print(f"[DEBUG] Output directory: {output_dir}")
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
            'verbose': True  # Add verbose output
        }
        
        print("[DEBUG] YoutubeDL options:", ydl_opts)
        
        with YoutubeDL(ydl_opts) as ydl:
            print("[DEBUG] Starting extraction...")
            info = ydl.extract_info(url, download=True)
            filename = f"{info['title']}.mp3"
            file_path = os.path.join(output_dir, filename)
            print(f"[DEBUG] Download completed: {file_path}")
            return file_path
    except Exception as e:
        error_msg = f"Download failed: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_msg}", file=sys.stderr)
        raise Exception(error_msg)

if __name__ == "__main__":
    try:
        if len(sys.argv) < 3:
            raise Exception("Missing arguments. Usage: script.py <url> <output_dir>")
        
        url = sys.argv[1]
        output_dir = sys.argv[2]
        
        print(f"[DEBUG] Script started with URL: {url}, Output Dir: {output_dir}")
        
        if not os.path.exists(output_dir):
            print(f"[DEBUG] Creating output directory: {output_dir}")
            os.makedirs(output_dir, exist_ok=True)
            
        result = download_video(url, output_dir)
        print(result)
    except Exception as e:
        print(f"[ERROR] {str(e)}", file=sys.stderr)
        sys.exit(1)