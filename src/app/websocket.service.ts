import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private websocket: WebSocket | undefined;
  private subject: Subject<any> = new Subject<any>();
  private reconnectInterval = 5000; // Intervalo de reconexión en milisegundos
  private maxReconnectAttempts = 10; // Número máximo de intentos de reconexión
  private reconnectAttempts = 0;

  constructor() {}

  connect(url: string): void {
    this.websocket = new WebSocket(url);

    this.websocket.onopen = () => {
      console.log('Conectado al servidor');
      this.reconnectAttempts = 0; // Reiniciar el contador de intentos al conectar
    };

    this.websocket.onclose = () => {
      console.log('Desconectado del servidor');
      this.reconnect();
    };

    this.websocket.onmessage = (event) => {
      this.subject.next(JSON.parse(event.data));
    };

    this.websocket.onerror = (event) => {
      console.error('WebSocket error:', event);
      this.reconnect();
    };
  }

  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Intentando reconectar... Intento ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(this.websocket!.url), this.reconnectInterval);
    } else {
      console.error('Número máximo de intentos de reconexión alcanzado.');
    }
  }

  send(data: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data));
    } else {
      console.error('No se puede enviar el mensaje, WebSocket no está conectado.');
    }
  }

  getMessages(): Observable<any> {
    return this.subject.asObservable();
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
    }
  }
}
