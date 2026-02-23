import { AppTemplateModel } from "../model/app-template.model";
import { wordpressAppTemplate } from "./apps/wordpress.template";
import { mariadbAppTemplate } from "./databases/mariadb.template";
import { mongodbAppTemplate } from "./databases/mongodb.template";
import { mysqlAppTemplate } from "./databases/mysql.template";
import { postgreAppTemplate } from "./databases/postgres.template";
import { postCreateRedisAppTemplate, redisAppTemplate } from "./databases/redis.template";
import { n8nAppTemplate } from "./apps/n8n.template";
import { noderedAppTemplate } from "./apps/nodered.template";
import { huginnAppTemplate } from "./apps/huginn.template";
import { nextcloudAppTemplate } from "./apps/nextcloud.template";
import { minioAppTemplate } from "./apps/minio.template";
import { filebrowserAppTemplate } from "./apps/filebrowser.template";
import { grafanaAppTemplate } from "./apps/grafana.template";
import { prometheusAppTemplate } from "./apps/prometheus.template";
import { uptimekumaAppTemplate } from "./apps/uptimekuma.template";
import { plausibleAppTemplate } from "./apps/plausible.template";
import { rocketchatAppTemplate } from "./apps/rocketchat.template";
import { mattermostAppTemplate } from "./apps/mattermost.template";
import { elementAppTemplate } from "./apps/element.template";
import { giteaAppTemplate } from "./apps/gitea.template";
import { forgejopAppTemplate } from "./apps/forgejo.template";
import { jenkinsAppTemplate } from "./apps/jenkins.template";
import { droneAppTemplate } from "./apps/drone.template";
import { sonarqubeAppTemplate } from "./apps/sonarqube.template";
import { harborAppTemplate } from "./apps/harbor.template";
import { jellyfinAppTemplate } from "./apps/jellyfin.template";
import { immichAppTemplate } from "./apps/immich.template";
import { photoprismAppTemplate } from "./apps/photoprism.template";
import { navidiomeAppTemplate } from "./apps/navidrome.template";
import { wikijsAppTemplate } from "./apps/wikijs.template";
import { outlineAppTemplate } from "./apps/outline.template";
import { docmostAppTemplate, postCreateDocmostAppTemplate } from "./apps/docmost.template";
import { hedgedocAppTemplate } from "./apps/hedgedoc.template";
import { vaultwardenAppTemplate } from "./apps/vaultwarden.template";
import { ghostAppTemplate } from "./apps/ghost.template";
import { nginxAppTemplate } from "./apps/nginx.template";
import { adminerAppTemplate } from "./apps/adminer.template";
import { drawioAppTemplate } from "./apps/drawio.template";
import { dozzleAppTemplate } from "./apps/dozzle.template";
import { homeassistantAppTemplate } from "./apps/homeassistant.template";
import { duplicatiAppTemplate, postCreateDuplicatiAppTemplate } from "./apps/duplicati.template";
import { openwebuiAppTemplate, postCreateOpenwebuiAppTemplate } from "./apps/openwebui.template";
import { AppExtendedModel } from "../model/app-extended.model";
import { tikaAppTemplate } from "./apps/tika.template";
import { libredeskAppTemplate, postCreateLibredeskAppTemplate } from "./apps/libredesk.template";


export const databaseTemplates: AppTemplateModel[] = [
    postgreAppTemplate,
    mongodbAppTemplate,
    mariadbAppTemplate,
    mysqlAppTemplate,
    redisAppTemplate,
];

// the commented out templates aren't tested yet.

export const appTemplates: AppTemplateModel[] = [
    wordpressAppTemplate,
    //n8nAppTemplate,
    //noderedAppTemplate,
    //huginnAppTemplate,
    nextcloudAppTemplate,
    minioAppTemplate,
    //filebrowserAppTemplate,
    // grafanaAppTemplate,
    //prometheusAppTemplate,
    uptimekumaAppTemplate,
    //plausibleAppTemplate,
    //rocketchatAppTemplate,
    //mattermostAppTemplate,
    //elementAppTemplate,
    giteaAppTemplate,
    //forgejopAppTemplate,
    //jenkinsAppTemplate,
    //droneAppTemplate,
    //sonarqubeAppTemplate,
    //harborAppTemplate,
    //jellyfinAppTemplate,
    //immichAppTemplate,
    //photoprismAppTemplate,
    //navidiomeAppTemplate,
    //wikijsAppTemplate,
    //outlineAppTemplate,
    docmostAppTemplate,
    //hedgedocAppTemplate,
    //vaultwardenAppTemplate,
    //ghostAppTemplate,
    nginxAppTemplate,
    adminerAppTemplate,
    drawioAppTemplate,
    //dozzleAppTemplate,
    //homeassistantAppTemplate,
    duplicatiAppTemplate,
    openwebuiAppTemplate,
    tikaAppTemplate,
    libredeskAppTemplate
];

export const postCreateTemplateFunctions: Map<string, (createdApps: AppExtendedModel[]) => Promise<AppExtendedModel[]>> = new Map([
    [openwebuiAppTemplate.name, postCreateOpenwebuiAppTemplate],
    [libredeskAppTemplate.name, postCreateLibredeskAppTemplate],
    [redisAppTemplate.name, postCreateRedisAppTemplate],
    [docmostAppTemplate.name, postCreateDocmostAppTemplate],
    [duplicatiAppTemplate.name, postCreateDuplicatiAppTemplate],
]);


export const allTemplates: AppTemplateModel[] = databaseTemplates.concat(appTemplates);