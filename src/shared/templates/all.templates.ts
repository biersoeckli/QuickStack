import { AppTemplateModel } from "../model/app-template.model";
import { wordpressAppTemplate } from "./apps/wordpress.template";
import { mariadbAppTemplate } from "./databases/mariadb.template";
import { mongodbAppTemplate } from "./databases/mongodb.template";
import { mysqlAppTemplate } from "./databases/mysql.template";
import { postgreAppTemplate } from "./databases/postgres.template";


export const databaseTemplates: AppTemplateModel[] = [
    postgreAppTemplate,
    mongodbAppTemplate,
    mariadbAppTemplate,
    mysqlAppTemplate
];

export const appTemplates: AppTemplateModel[] = [
    wordpressAppTemplate
];


export const allTemplates: AppTemplateModel[] = databaseTemplates.concat(appTemplates);