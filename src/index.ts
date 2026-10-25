/** Host half of the independent `dsh-mobile-access` bundle. */

import { LanGateway } from './gateway.js'
import { registerMobileAccess } from './routes.js'
import { PairingService } from './service.js'
import type { PluginContext } from './types.js'

export const name = 'dsh-mobile-access'
export const inject = ['webServer', 'connection']

/**
 * Register the additive routes and, only when the official listener is bound
 * to loopback, start the optional LAN gateway. A DSH already bound to a LAN
 * address never opens another listener.
 */
export function apply(ctx: PluginContext): void {
  const service = new PairingService()
  let gateway: LanGateway | undefined
  try {
    gateway = new LanGateway({ targetOrigin: ctx.webServer.getOrigin() })
  } catch (error) {
    ctx.logger?.warn?.(`[mobile-access] gateway disabled: ${error instanceof Error ? error.message : String(error)}`)
  }
  ctx.effect(() => {
    const dispose = registerMobileAccess(ctx, service, gateway)
    if (gateway !== undefined) {
      void gateway.start().then(() => {
        const status = gateway?.status()
        if (status?.running === true) ctx.logger?.info?.(`[mobile-access] LAN gateway on ${status.publicOrigin ?? 'unknown'}`)
      }).catch((error: unknown) => {
        ctx.logger?.warn?.(`[mobile-access] gateway failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    ctx.logger?.info?.('[mobile-access] routes registered')
    return () => {
      dispose()
      if (gateway !== undefined) void gateway.stop()
      ctx.logger?.info?.('[mobile-access] routes disposed')
    }
  }, 'mobile-access routes')
}
