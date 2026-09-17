import ProjectPage from "./projects/project-page";
import HostnameCheck from "./settings/hostname-check";

export default async function Home() {
  return <>
    <ProjectPage />
    <HostnameCheck />
  </>;
}
