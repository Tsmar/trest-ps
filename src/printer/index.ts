// @ts-ignore
import escpos from 'escpos'
import usb from './usb'
import net from './net'
// import Network from 'escpos-network'

escpos.Network = net
escpos.USB = usb

export enum PrinterConnectionType {
  USB = 'USB',
  LAN = 'LAN',
  BLUETOOTH = 'BLUETOOTH',
}

type ReceiptData = {
  title: string
  items: { name: string; quantity: number; price: number }[]
  total: number
}

enum PrintDataType {
  TEST = 'TEST',
  RECEIPT = 'RECEIPT',
  RECIPE = 'RECIPE',
}

type PrintData = {
  type: PrintDataType
  data?: ReceiptData | undefined
}

escpos.Printer.prototype.sizeOne = function () {
  this.buffer.write('\x1b\x21\x00')
  return this
}

escpos.Printer.prototype.sizeTwo = function () {
  this.buffer.write('\x1b\x21\x30')
  return this
}

export default class Printer {
  private type: PrinterConnectionType
  private address: string = 'localhost'
  private port: number = 9100
  private device: escpos.USB | escpos.Network
  private printer: escpos.Printer
  private isBusy: boolean = false

  constructor(type: PrinterConnectionType = PrinterConnectionType.USB, address?: string, port?: number) {
    if (type === PrinterConnectionType.LAN) {
      this.address = address || 'localhost'
      this.port = port || 9100
    }
    this.type = type

    switch (this.type) {
      case PrinterConnectionType.USB:
        console.log('Printer: USB')
        this.device = new escpos.USB()
        break
      case PrinterConnectionType.LAN:
        console.log('Printer: LAN', this.address + ':' + this.port)
        this.device = new escpos.Network(this.address, this.port)
        break
      default:
        console.error('Printer: unknown connection type', this.type)
    }
    this.printer = new escpos.Printer(this.device) //, { encoding: 'CP866' })

    // bind events
    if (this.type === PrinterConnectionType.USB) {
      // USB only
      this.device.on('detach', () => {
        this.device = undefined
        console.log('Printer: disconnected')
      })
    }
    this.device.on('error', (error: any) => {
      if (!error) return
      console.warn('Printer:', error.toString())
    })
  }

  public getStatus(): boolean {
    return this.isActive()
  }

  public async check() {
    this.device.open()
  }

  public print(data: PrintData) {
    if (this.isBusy) {
      // this.addToQue
    }
    try {
      this.device.open()
    } catch (error) {
      console.error('Printer: open error', error)
      return
    }
    this.device.on('connect', () => {
      this.isBusy = true
      console.log('Printer: start printing', data.type)
      switch (data.type) {
        case PrintDataType.TEST:
          this.printTest()
          break
        case PrintDataType.RECEIPT:
          const receiptData = data.data as ReceiptData
          this.printReceipt(receiptData)
          break
        default:
          console.error('Printer: unknown command type', data.type)
      }
      console.log('Printer: printing done')
      this.isBusy = false
    })
  }

  private isActive() {
    return this.device !== undefined && this.printer !== undefined
  }

  private async printTest() {
    const data = {
      title: 'ACafe',
      items: [
        { name: 'Chicken wrap', quantity: 1, price: 200.0 },
        { name: 'Salmon wrap', quantity: 1, price: 250.0 },
        { name: 'Cappuccino', quantity: 2, price: 100.0 },
        { name: 'Latte', quantity: 1, price: 150.0 },
      ],
      total: 450.0,
    }

    // title
    // this.printer.align('ct').sizeTwo().style('b').text('-= A Cafe =-').feed(2).align('lt').sizeOne().style('noraml')
    await this.drawImage()
    // // header
    this.printer
      .feed(2)
      .style('b')
      .tableCustom([
        { text: 'Item', align: 'LEFT', width: 0.7 },
        { text: 'Price', align: 'RIGHT', width: 0.3 },
      ])
      .style('noraml')
      .drawLine()
    // // items
    data.items.forEach(item => {
      this.printer.tableCustom([
        { text: item.name, align: 'LEFT', width: 0.6 },
        {
          text: item.quantity + ' x ' + item.price.toFixed(2) + ' = ' + (item.quantity * item.price).toFixed(2),
          align: 'RIGHT',
          width: 0.4,
        },
      ])
    })
    // total
    this.printer
      .style('b')
      .feed(1)
      .drawLine()
      .tableCustom([
        { text: 'Total', align: 'LEFT', width: 0.5 },
        { text: data.total.toFixed(2) + ' thb', align: 'RIGHT', width: 0.5 },
      ])
    this.printer.feed(4).cut().close()
  }

  private printReceipt(data: ReceiptData) {
    this.printer.align('ct')
    // this.printer.font('a')
    // this.printer.size(2, 2)
    this.printer.feed(2)
    this.printer.text(data.title)
    // this.printer.size(1, 1)
    this.printer.feed(1)
    this.printer.align('lt')

    data.items.forEach(item => {
      this.printer.text(`${item.name}    ${item.price.toFixed(2)}`)
    })

    this.printer
      .feed(1)
      .style('b')
      .text(`Total: ${data.total.toFixed(2)} thb`)
      .feed(2)
      .cut()
      .close()
  }

  private async drawImage() {
    return new Promise<void>(resolve => {
      escpos.Image.load('./images/logo2.png', (image: any) => {
        this.printer
          .align('ct')
          .image(image, 's8')
          .then(() => {
            resolve()
          })
      })
    })
  }
}
