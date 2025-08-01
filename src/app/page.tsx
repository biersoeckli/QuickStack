import ProjectPage from "./projects/project-page";
import paramService, { ParamService } from "@/server/services/param.service";
import HostnameCheck from "./settings/server/hostname-check";
import versionService from "@/server/services/version.service";

export default async function Home() {
  const version = await versionService.isInstalledQuickStackVersionTheLatestVersion();
  return <>
    <ProjectPage />
    <HostnameCheck />
  </>;
}
