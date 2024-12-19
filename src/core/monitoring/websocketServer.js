import { WebSocketServer, WebSocket } from 'ws'; // Correct destructured import for ws

class WebSocketServerManager {
  constructor() {
    this.server = null;
    this.clients = new Set();
  }

  /**
   * Initialize the WebSocket server.
   * @param {Object} httpServer - The HTTP server instance to attach the WebSocket server.
   */
  initialize(httpServer) {
    this.server = new WebSocketServer({ server: httpServer });

    this.server.on('connection', (ws) => {
      console.log('WebSocket client connected');
      this.clients.add(ws);

      // Remove client on disconnect
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle incoming messages (if needed)
      ws.on('message', (message) => {
        console.log('Received WebSocket message:', message);
      });
    });
  }

  /**
   * Broadcast a message to all connected clients.
   * @param {Object} message - The message to broadcast.
   */
  broadcast(message) {
    const messageString = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }
}

// Singleton instance of WebSocketServerManager
const websocketServer = new WebSocketServerManager();
export default websocketServer;
