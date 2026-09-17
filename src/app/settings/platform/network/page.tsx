import paramService, { ParamService } from "@/server/services/param.service"
import traefikService from "@/server/services/traefik.service"
import QuickStackIngressSettings from "./qs-ingress-settings"
import QuickStackPublicIpSettings from "./qs-public-ip-settings"
import QuickStackLetsEncryptSettings from "./qs-letsencrypt-settings"
import QuickStackTraefikSettings from "./qs-traefik-settings"
import { ServerSettingsPage } from "../../server-settings-page"

export default async function NetworkSettingsPage() {
  const [serverUrl, disableNodePortAccess, publicIpv4, letsEncryptMail, traefikStatus] = await Promise.all([
    paramService.getString(ParamService.QS_SERVER_HOSTNAME), paramService.getBoolean(ParamService.DISABLE_NODEPORT_ACCESS), paramService.getString(ParamService.PUBLIC_IPV4_ADDRESS), paramService.getString(ParamService.LETS_ENCRYPT_MAIL), traefikService.getStatus(),
  ])
  return <ServerSettingsPage title="Network & Domains">
    <div className="grid gap-6">
      <QuickStackIngressSettings disableNodePortAccess={disableNodePortAccess!} serverUrl={serverUrl!} />
      <QuickStackPublicIpSettings publicIpv4={publicIpv4} />
      <QuickStackLetsEncryptSettings letsEncryptMail={letsEncryptMail!} />
      <QuickStackTraefikSettings initialStatus={traefikStatus} />
    </div>
  </ServerSettingsPage>
}
