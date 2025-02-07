import type { Server } from 'bun'
import type PrintServer from './PrintServer'
import htmlPage from '../assets/index.html'

export default class HttpServer {
  private httpServer: Server

  constructor(printServer: PrintServer, port: number = 3300) {
    this.httpServer = Bun.serve({
      port,
      static: { '/': htmlPage },
      async fetch(req) {
        if (req.url.endsWith('/api/settings')) {
          if (req.method === 'GET') {
            return new Response(JSON.stringify(printServer.getCredentials()), {
              headers: { 'Content-Type': 'application/json' },
            })
          }
          if (req.method === 'POST') {
            const data = await req.json()
            return new Response(JSON.stringify(printServer.setCredentials(data)), {
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }

        if (req.url.endsWith('/api/status')) {
          return new Response(JSON.stringify({ status: printServer.isConnected() }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (req.url.endsWith('/api/printers')) {
          return new Response(JSON.stringify(printServer.getPrinters()), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Return 404 for unmatched routes
        return new Response('Not Found', { status: 404 })
      },
    })
    console.log(`HttpServer listening on ${this.httpServer.url}`)
    console.log('-----------------------------------')
  }
}
