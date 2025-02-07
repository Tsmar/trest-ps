import net from 'node:net'
import { EventEmitter } from 'events'

export default class TrestNetwork extends EventEmitter {
  private address: string
  private port: number
  private device: net.Socket | null

  constructor(address: string, port: number) {
    super()
    this.address = address
    this.port = port || 9100
    this.device = new net.Socket()
  }

  open(callback?: (err: Error | null, device: net.Socket | null) => void) {
    if (!this.device) {
      throw new Error('Network: printer not found')
    }
    this.device.on('error', error => {
      console.log('Network: error', error)
      this.emit('error', error)
      callback && callback(error, this.device)
    })
    this.device.on('data', () => {})
    console.log('Network: connecting to', this.address, this.port)
    this.device.connect(
      {
        host: this.address,
        port: this.port,
      },
      () => {
        this.emit('connect', this.device)
        callback && callback(null, this.device)
      },
    )
    return this
  }

  write(data: Buffer, callback: () => void) {
    this.device?.write(data, callback)
    return this
  }

  read(callback: (buf: Buffer) => void) {
    this.device?.on('data', buf => {
      callback && callback(buf)
    })
    return this
  }

  close(callback: (err: Error | null, device: net.Socket | null) => void) {
    if (this.device) {
      this.device.destroy()
      this.device = null
    }
    this.emit('disconnect', this.device)
    callback && callback(null, this.device)
    return this
  }
}
