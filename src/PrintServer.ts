// import { Database } from 'bun:sqlite'
import fs from 'fs'
import { io, Socket } from 'socket.io-client'
import Printer, { PrinterConnectionType } from './printer/index'

export type ServerOptions = {
  apiHost: string
  apiKey: string
}

type PrinterConfig = {
  id: number
  name: string
  type: PrinterConnectionType
  location: string
  address: string
  port: number
  printer?: Printer
}

type PrinterStatus = {
  id: number
  status: boolean
}

export default class PrintServer {
  private apiHost: string = ''
  private apiKey: string = ''
  private connectionStatus: boolean = false
  private socket: Socket | null = null
  private printers: PrinterConfig[] = []
  private statusInterval: Timer | null = null
  private connectionCheckInterval: Timer | null = null
  private isEventsBinded: boolean = false
  // private db: Database = new Database('./app.settings')

  constructor() {}

  public async start() {
    console.log('PrintServer: starting...')
    this.disconnect()
    this.loadSettings()
    await this.connect()
  }

  public getCredentials(): ServerOptions {
    return {
      apiHost: this.apiHost,
      apiKey: this.apiKey,
    }
  }

  public async setCredentials(credentials: ServerOptions) {
    this.apiHost = credentials.apiHost
    this.apiKey = credentials.apiKey
    this.saveSettings()
    await this.start()
  }

  public isConnected(): boolean {
    return this.connectionStatus
  }

  public getPrinters(): PrinterConfig[] {
    return this.printers.map(printer => {
      return {
        id: printer.id,
        name: printer.name,
        type: printer.type,
        location: printer.location,
        address: printer.address,
        port: printer.port,
      }
    })
  }

  private async connect() {
    if (this.socket && this.socket.connected) {
      return true
    }
    if (!this.apiHost || !this.apiKey) {
      console.log('PrintServer: no credentials')
      return false
    }
    if (!this.socket) {
      this.socket = io(this.getHost(true), {
        transports: ['websocket', 'polling'],
        autoConnect: false,
        extraHeaders: {
          Authorization: this.apiKey,
        },
      })
    }

    if (!this.isEventsBinded) {
      this.socket.on('connect', async () => {
        console.log('PrintServer: connected')
        this.connectionStatus = true
        setTimeout(async () => {
          this.getPrinterConfigs()
        }, 1000)
      })

      this.socket.on('printers', printers => {
        this.printers = printers
        console.log('PrintServer: printers configuration loaded')
        this.initPrinters()
        this.sendPrinterStatuses()
        this.startUpdateStatuses()
      })

      this.socket.on('update', data => {
        console.log('PrintServer: notified about update')
        this.getPrinterConfigs()
      })

      this.socket.on('cmd', data => {
        // console.log('PrintServer: received command', data.type)
        this.printers.forEach((printer, index) => {
          if (printer.id === data.id) {
            this.printers[index].printer?.print(data)
          }
        })
      })

      this.socket.on('disconnect', () => {
        console.log('PrintServer: disconnected from cloude service')
        this.connectionStatus = false
      })

      this.socket.on('error', error => {
        console.error('PrintServer: connection to cloud service error', error)
      })
    }
    this.isEventsBinded = true

    this.socket.connect()
    this.startConnectionCheck()
  }

  private disconnect() {
    if (this.socket && this.socket.connected) {
      this.socket.disconnect()
    }
    this.connectionStatus = false
    this.socket = null
    this.isEventsBinded = false
  }

  private startConnectionCheck(timeout: number = 5000) {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
    }
    this.connectionCheckInterval = setInterval(async () => {
      if (this.socket && !this.socket.connected) {
        console.log('PrintServer: connection lost, trying to reconnect...')
        this.disconnect()
        await this.connect()
      }
    }, timeout)
  }

  private startUpdateStatuses(timeout: number = 5000) {
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
    }
    this.statusInterval = setInterval(() => {
      this.sendPrinterStatuses()
    }, timeout)
  }

  private getPrinterConfigs() {
    console.log('PrintServer: getting printers...')
    if (!this.socket || !this.socket.connected) {
      return
    }
    this.socket.emit('getPrinters')
  }

  private initPrinters() {
    this.printers.forEach(async (printer, index) => {
      console.log(`PrintServer: reading config for printer "${printer.name}"...`)
      this.printers[index].printer = new Printer(printer.type, printer.address, printer.port)
    })
  }

  private sendPrinterStatuses() {
    if (!this.socket || !this.socket.connected) {
      return
    }
    this.socket.emit('updatePrinterStatus', this.getPrinterStatuses())
  }

  private getPrinterStatuses(): PrinterStatus[] {
    const result: PrinterStatus[] = []
    this.printers.forEach((printer, index) => {
      result.push({
        id: printer.id,
        status: this.printers[index].printer?.getStatus() || false,
      })
    })
    return result
  }

  private getHost(wss: boolean = false) {
    const ssl = this.apiHost.includes('localhost:') ? '' : 's'
    const protocol = wss ? 'ws' : 'http'
    return protocol + ssl + '://' + this.apiHost
  }

  private loadSettings() {
    console.log('PrintServer: loading settings...')
    if (!fs.existsSync('./settings.json')) {
      console.log('PrintServer: settings not found')
      this.apiHost = ''
      this.apiKey = ''
      return
    }
    const data = fs.readFileSync('./settings.json', 'utf8')
    const result = JSON.parse(data) as ServerOptions
    this.apiHost = result.apiHost
    this.apiKey = result.apiKey
    console.log('PrintServer: settings loaded')
  }

  private saveSettings() {
    console.log('PrintServer: saving settings...')
    const data = JSON.stringify({
      apiHost: this.apiHost,
      apiKey: this.apiKey,
    })
    fs.writeFileSync('./settings.json', data)
  }
}
