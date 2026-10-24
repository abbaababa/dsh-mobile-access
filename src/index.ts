/** Host half of the independent `dsh-mobile-access` bundle. */

import { registerMobileAccess } from './routes.js'
import { PairingService } from './service.js'
import type { PluginContext } from './types.js'

export const name = 'dsh-mobile-access'
export const inject = ['webServer', 'connection']

/**
 * Register exactly three additive routes. No existing route, auth record,
 * profile setting, layout component, or client root is read or replaced.
 */
export function apply(ctx: PluginContext): void {
  const service = new PairingService()
  ctx.effect(() => {
    const dispose = registerMobileAccess(ctx, service)
    ctx.logger?.info?.('[mobile-access] routes registered')
    return () => {
      dispose()
      ctx.logger?.info?.('[mobile-access] routes disposed')
    }
  }, 'mobile-access routes')
}
