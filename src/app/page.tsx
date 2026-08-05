import ProjectPage from "./projects/project-page";
import HostnameCheck from "./settings/server/hostname-check";

export default async function Home() {
  return <>
    <ProjectPage />
    <HostnameCheck />
  </>;
}
