from yt_dlp import YoutubeDL
import sys
import os

def download_video(url, output_dir):
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        }
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = f"{info['title']}.mp3"
            file_path = os.path.join(output_dir, filename)
            return file_path
    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")

if __name__ == "__main__":
    url = sys.argv[1]
    output_dir = sys.argv[2]
    result = download_video(url, output_dir)
    print(result)