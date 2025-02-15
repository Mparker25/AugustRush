from fastapi import FastAPI, HTTPException, WebSocket
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from pathlib import Path
import uvicorn
from typing import List
import asyncio

app = FastAPI()

# Store active WebSocket connections
active_connections: List[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        active_connections.remove(websocket)

# Broadcast progress to all connected clients
async def broadcast_progress(data: dict):
    for connection in active_connections:
        try:
            await connection.send_json(data)
        except:
            active_connections.remove(connection)

class DownloadRequest(BaseModel):
    url: str

@app.post("/download")
async def download_audio(request: DownloadRequest):
    try:
        output_path = Path(__file__).parent.parent / 'frontend' / 'downloads'
        
        def postprocessor_hook(d):
            if d['status'] == 'started':
                # Create and await the broadcast task immediately
                loop = asyncio.get_event_loop()
                loop.call_soon(broadcast_progress({
                    'status': 'converting'
                }), name='broadcast_converting')
                
            elif d['status'] == 'finished':
                loop = asyncio.get_event_loop()
                loop.call_soon(broadcast_progress({
                    'status': 'finished'
                }), name='broadcast_finished')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'postprocessor_hooks': [postprocessor_hook],
            'outtmpl': str(output_path / '%(title)s.%(ext)s'),
        }

        # Send initial "started" message
        await broadcast_progress({
            'status': 'started'
        })
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=True)
            print(info)
            filename = f"{info['title']}.mp3"
            file_path = output_path / filename
            
        return {
            'status': 'success',
            'file_path': str(file_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    uvicorn.run(app, host="0.0.0.0", port=5000)
