import { AppTemplateModel } from "../model/app-template.model";
import { wordpressAppTemplate } from "./apps/wordpress.template";
import { mariadbAppTemplate } from "./databases/mariadb.template";
import { mongodbAppTemplate } from "./databases/mongodb.template";
import { mysqlAppTemplate } from "./databases/mysql.template";
import { postgreAppTemplate } from "./databases/postgres.template";
import { postCreateRedisAppTemplate, redisAppTemplate } from "./databases/redis.template";
import { n8nAppTemplate, postCreateN8NAppTemplate } from "./apps/n8n.template";
import { nextcloudAppTemplate } from "./apps/nextcloud.template";
import { minioAppTemplate } from "./apps/minio.template";
import { uptimekumaAppTemplate } from "./apps/uptimekuma.template";
import { giteaAppTemplate } from "./apps/gitea.template";
import { docmostAppTemplate, postCreateDocmostAppTemplate } from "./apps/docmost.template";
import { nginxAppTemplate } from "./apps/nginx.template";
import { adminerAppTemplate } from "./apps/adminer.template";
import { drawioAppTemplate } from "./apps/drawio.template";
import { duplicatiAppTemplate, postCreateDuplicatiAppTemplate } from "./apps/duplicati.template";
import { openwebuiAppTemplate, postCreateOpenwebuiAppTemplate } from "./apps/openwebui.template";
import { AppExtendedModel } from "../model/app-extended.model";
import { tikaAppTemplate } from "./apps/tika.template";
import { libredeskAppTemplate, postCreateLibredeskAppTemplate } from "./apps/libredesk.template";
import { chiselAppTemplate, postCreateChiselAppTemplate } from "./apps/chisel.template";


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
    n8nAppTemplate,
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
    libredeskAppTemplate,
    chiselAppTemplate
];

export const postCreateTemplateFunctions: Map<string, (createdApps: AppExtendedModel[]) => Promise<AppExtendedModel[]>> = new Map([
    [openwebuiAppTemplate.name, postCreateOpenwebuiAppTemplate],
    [libredeskAppTemplate.name, postCreateLibredeskAppTemplate],
    [redisAppTemplate.name, postCreateRedisAppTemplate],
    [docmostAppTemplate.name, postCreateDocmostAppTemplate],
    [duplicatiAppTemplate.name, postCreateDuplicatiAppTemplate],
    [n8nAppTemplate.name, postCreateN8NAppTemplate],
    [chiselAppTemplate.name, postCreateChiselAppTemplate],
]);


export const allTemplates: AppTemplateModel[] = databaseTemplates.concat(appTemplates);