import { Component, OnInit, OnDestroy } from '@angular/core';

import { WebsocketService } from '../websocket.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-video-stream',
  templateUrl: './video-stream.component.html',
  styleUrls: ['./video-stream.component.css']
})
export class VideoStreamComponent implements OnInit, OnDestroy {
  private videoElement: HTMLVideoElement | undefined;
  private canvasElement: HTMLCanvasElement | undefined;
  private context: CanvasRenderingContext2D | undefined;
  private captureInterval: Subscription | undefined;
  private bbox: any;
  private latencyList: number[] = [];
  private startTime: number = 0;
  private fps: number = 30; // Frames per second (adjustable)
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.videoElement = document.querySelector('video') as HTMLVideoElement;
      this.canvasElement = document.querySelector('.bounding-box-canvas') as HTMLCanvasElement;
      this.context = this.canvasElement?.getContext('2d')!;
  
      if (!this.context) {
        console.error("Error: Contexto 2D del canvas no disponible");
      } else {
        console.log("Contexto 2D inicializado correctamente");
      }
  
      this.connectWebSocket();
      this.startVideoStream();
    }
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }
 

  private connectWebSocket(): void {
    this.websocketService.connect('ws://13.51.158.147:5000');
    this.websocketService.getMessages().subscribe({
      next: data => this.receiveBoundingBox(data),
      error: err => this.handleWebSocketError(err),
      complete: () => this.handleWebSocketClose()
    });
  }

  private handleWebSocketError(err: any): void {
    console.error('WebSocket error:', err);
    this.attemptReconnect();
  }

  private handleWebSocketClose(): void {
    console.warn('WebSocket connection closed');
    this.attemptReconnect();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connectWebSocket(), 2000);
    } else {
      console.error('Max reconnect attempts reached. Could not reconnect to WebSocket.');
    }
  }

  private startVideoStream(): void {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      if (this.videoElement) {
        this.videoElement.srcObject = stream;
      }
      this.captureFrames();
    }).catch(err => {
      console.error('Error accessing video stream:', err);
    });
  }

  private captureFrames(): void {
    this.captureInterval = interval(1000 / this.fps).subscribe(() => {
      if (this.videoElement && this.context) {
              // Obtén las dimensiones originales del video
      const originalWidth = this.videoElement.videoWidth;
      const originalHeight = this.videoElement.videoHeight;

      // Establece las nuevas dimensiones deseadas para reducir la resolución
      const targetWidth = 320;  // Ancho deseado para la imagen
      const targetHeight = (originalHeight / originalWidth) * targetWidth; // Mantiene la relación de aspecto

      // Ajusta el tamaño del canvas para coincidir con las dimensiones deseadas
      this.canvasElement!.width = targetWidth;
      this.canvasElement!.height = targetHeight;

      // Dibuja el video redimensionado en el canvas
      this.context.drawImage(this.videoElement, 0, 0, targetWidth, targetHeight);
        const frame = this.canvasElement?.toDataURL('image/jpeg', 0.4).split(',')[1];
        this.startTime = performance.now();
        this.websocketService.send({ frame });
      }
    });
  }
  

  private receiveBoundingBox(data: any): void {
    this.bbox = data;
    const latency = performance.now() - this.startTime;
    this.latencyList.push(latency);
    this.updateMetrics();
    this.drawBoundingBox();
    this.adjustFpsBasedOnLatency();
  }

  
  private drawBoundingBox(): void {
    if (this.bbox && this.context && this.canvasElement && this.videoElement) {
      const { x, y, w, h, colorRectangle } = this.bbox;
  
      // Ajusta el tamaño del canvas para que coincida con el tamaño del video
      this.canvasElement.width = this.videoElement.clientWidth;
      this.canvasElement.height = this.videoElement.clientHeight;
  
      // Limpia el canvas antes de dibujar
      this.context.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  
      // Establece el factor de escala basado en las dimensiones del video y el canvas
      const scaleX = this.canvasElement.width / this.videoElement.videoWidth;
      const scaleY = this.canvasElement.height / this.videoElement.videoHeight;
  
      // Escala las coordenadas del bounding box para ajustarse al tamaño redimensionado del canvas
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledW = w * scaleX;
      const scaledH = h * scaleY;
  
      // Dibuja el bounding box redimensionado
      this.context.strokeStyle = `rgb(${colorRectangle[0]}, ${colorRectangle[1]}, ${colorRectangle[2]})`;
      this.context.lineWidth = 2;
      this.context.strokeRect(scaledX, scaledY, scaledW, scaledH);
    }
  }

  private updateMetrics(): void {
    if (this.bbox) {
      const { orientation, text4User, textFacDis, x, y, w, h } = this.bbox;
  
      const orientationElement = document.getElementById('orientation');
      const text4UserElement = document.getElementById('text4User');
      const textFacDisElement = document.getElementById('textFacDis');
      const latencyElement = document.getElementById('latency');
      const boundingBoxInfoElement = document.getElementById('boundingBoxInfo');
  
      if (orientationElement) orientationElement.textContent = orientation || 'N/A';
      if (text4UserElement) text4UserElement.textContent = text4User || 'N/A';
      if (textFacDisElement) textFacDisElement.textContent = textFacDis || 'N/A';
  
      const lastLatency = this.latencyList[this.latencyList.length - 1];
      const avgLatency = this.latencyList.reduce((a, b) => a + b, 0) / this.latencyList.length;
  
      if (latencyElement) {
        latencyElement.textContent = `Last=${lastLatency.toFixed(3)} ms, Avg=${avgLatency.toFixed(3)} ms`;
      }
  
      if (boundingBoxInfoElement) {
        boundingBoxInfoElement.textContent = `x: ${x}, y: ${y}, width: ${w}, height: ${h}`;
      }
    }
  }
  

  private adjustFpsBasedOnLatency(): void {
    const avgLatency = this.latencyList.reduce((a, b) => a + b, 0) / this.latencyList.length;
    if (avgLatency > 100) {
      this.fps = 15; // Reduce FPS if latency is high
    } else if (avgLatency > 50) {
      this.fps = 20; // Moderate FPS
    } else {
      this.fps = 30; // Full FPS if latency is low
    }
  }

  private cleanupResources(): void {
    if (this.captureInterval) {
      this.captureInterval.unsubscribe();
    }
    this.websocketService.disconnect();
  }
}
