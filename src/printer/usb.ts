import os from 'os'
import EventEmitter from 'events'
import { usb, getDeviceList, Endpoint, Device, findByIds } from 'usb'

const INTERFACE_CLASS_PRINTER = 0x07

export default class TrestUSB extends EventEmitter {
  public device: Device | undefined = undefined
  private endpoint: Endpoint | undefined = undefined
  private vid: number | undefined = undefined
  private pid: number | undefined = undefined

  constructor(vid: number, pid: number) {
    super()
    this.vid = vid
    this.pid = pid
    this.searchDevice()

    // set event listener for detach
    usb.on('detach', device => {
      if (device === this.device) {
        this.emit('detach', device)
        this.emit('disconnect', device)
        this.device = undefined
      }
    })
  }

  private searchDevice() {
    if (this.vid && this.pid) {
      this.device = findByIds(this.vid, this.pid)
    } else {
      const list = TrestUSB.findPrinter()
      if (list && list.length) this.device = list[0]
    }
    if (!this.device) throw new Error('USB: Can not find printer')
  }

  open() {
    let counter = 0
    let index = 0
    if (!this.device) {
      throw new Error('USB: printer not found')
    }
    this.device.open()
    if (!this.device.interfaces || !this.device.interfaces.length) {
      throw new Error('USB: printer has no interfaces')
    }

    for (const iface of this.device.interfaces) {
      iface.setAltSetting(iface.altSetting, () => {
        if ('win32' !== os.platform()) {
          if (iface.isKernelDriverActive()) {
            try {
              iface.detachKernelDriver()
            } catch (e) {
              console.error('[ERROR] Could not detatch kernel driver: %s', e)
            }
          }
        }
        iface.claim() // must be called before using any endpoints of this interface.
        iface.endpoints.filter(endpoint => {
          if (endpoint.direction == 'out' && !this.endpoint) {
            this.endpoint = endpoint
          }
        })
        if (this.endpoint) {
          this.emit('connect', this.device)
        } else if (++counter === this.device?.interfaces?.length && !this.endpoint) {
          throw new Error('Can not find endpoint from printer')
        }
      })
    }
    return this
  }

  write(data: any, callback: (error: Error | null) => void) {
    if (!this.endpoint) {
      throw new Error('USB: endpoint not found')
    }
    this.emit('data', data)
    // @ts-ignore
    this.endpoint.transfer(data, callback)
    return this
  }

  close(callback: (error: Error | null) => void) {
    if (this.device) {
      try {
        this.device.close()
        // TODO: is it necessary to remove all listeners?
        usb.removeAllListeners('detach')

        callback && callback(null)
        this.emit('close', this.device)
      } catch (e: any) {
        callback && callback(e)
      }
    } else {
      callback && callback(null)
    }

    return this
  }

  static findPrinter() {
    return getDeviceList().filter((device: Device) => {
      try {
        if (!device.configDescriptor) {
          return false
        }
        return device.configDescriptor.interfaces.filter(item => {
          return item.filter(descriptor => {
            return descriptor.bInterfaceClass === INTERFACE_CLASS_PRINTER
          }).length
        }).length
      } catch (e) {
        return false
      }
    })
  }
}
