import { AppTemplateUtils } from '@/server/utils/app-template.utils';
import appTemplateService from '../../../server/services/app-template.service';
import { AppTemplateContentModel, AppTemplateInputSettingsModel } from '@/shared/model/app-template.model';
import crypto from 'crypto';
import { AppExtendedModel } from '@/shared/model/app-extended.model';
import { DatabaseTemplateInfoModel } from '@/shared/model/database-template-info.model';
import { KubeObjectNameUtils } from '@/server/utils/kube-object-name.utils';
import { ServiceException } from '@/shared/model/service.exception.model';

jest.mock('crypto', () => ({
    randomBytes: jest.fn(() => ({
        toString: jest.fn(() => 'mockedRandomValue')
    }))
}));

describe('AppTemplateService', () => {
    describe('populateRandomValues', () => {
        it('should populate random values for inputs with randomGeneratedIfEmpty set to true and value is empty', () => {
            const inputValues: AppTemplateInputSettingsModel[] = [
                { key: 'key1', value: '', randomGeneratedIfEmpty: true, isEnvVar: false, label: '' },
                { key: 'key2', value: 'existingValue', randomGeneratedIfEmpty: true, isEnvVar: false, label: '' },
                { key: 'key3', value: '', randomGeneratedIfEmpty: false, isEnvVar: false, label: '' }
            ];

            AppTemplateUtils.populateRandomValues(inputValues);

            expect(inputValues[0].value).toBe('mockedRandomValue');
            expect(inputValues[1].value).toBe('existingValue');
            expect(inputValues[2].value).toBe('');
        });

        it('should not change values for inputs with randomGeneratedIfEmpty set to false', () => {
            const inputValues: AppTemplateInputSettingsModel[] = [
                { key: 'key1', value: '', randomGeneratedIfEmpty: false, isEnvVar: false, label: '' }
            ];

            AppTemplateUtils.populateRandomValues(inputValues);

            expect(inputValues[0].value).toBe('');
        });

        it('should not change values for inputs with randomGeneratedIfEmpty set to true but value is not empty', () => {
            const inputValues: AppTemplateInputSettingsModel[] = [
                { key: 'key1', value: 'existingValue', randomGeneratedIfEmpty: true, isEnvVar: false, label: '' }
            ];

            AppTemplateUtils.populateRandomValues(inputValues);

            expect(inputValues[0].value).toBe('existingValue');
        });

        jest.mock('crypto', () => ({
            randomBytes: jest.fn(() => ({
                toString: jest.fn(() => 'mockedRandomValue')
            }))
        }));



        describe('mapTemplateInputValuesToApp', () => {
            it('should map template input values to app model', () => {
                const appTemplate: any = {
                    appModel: { envVars: '' }
                };
                const inputValues: AppTemplateInputSettingsModel[] = [
                    { key: 'ENV_VAR1', value: 'value1', randomGeneratedIfEmpty: false, isEnvVar: true, label: '' },
                    { key: 'configKey', value: 'configValue', randomGeneratedIfEmpty: false, isEnvVar: false, label: '' }
                ];

                const app = AppTemplateUtils.mapTemplateInputValuesToApp(appTemplate, inputValues);

                expect(app.envVars).toContain('ENV_VAR1=value1');
                expect((app as any).configKey).toBe('configValue');
            });
        });

        describe('replacePlaceholdersInEnvVariablesWithDatabaseInfo', () => {
            it('should replace placeholders in env variables with database info', () => {
                const app: AppExtendedModel = {
                    envVars: 'DB_NAME={databaseName} {username} {password} {port} {hostname}',
                    appType: 'MYSQL',
                    appPorts: [{ port: 3306 }],
                    id: 'app-id'
                } as AppExtendedModel;
                const databaseInfo: DatabaseTemplateInfoModel = {
                    databaseName: 'testDB',
                    username: 'testUser',
                    password: 'testPass',
                    port: 3306,
                    hostname: 'localhost',
                    internalConnectionUrl: 'mongodb://localhost:3306/testDB'
                };

                AppTemplateUtils.replacePlaceholdersInEnvVariablesWithDatabaseInfo(app, databaseInfo);

                expect(app.envVars).toBe('DB_NAME=testDB testUser testPass 3306 localhost');
            });
        });

        describe('getDatabaseModelFromApp', () => {
            it('should return database model for MONGODB app type', () => {
                const app: AppExtendedModel = {
                    appType: 'MONGODB',
                    envVars: 'MONGO_INITDB_DATABASE=testDB\nMONGO_INITDB_ROOT_USERNAME=testUser\nMONGO_INITDB_ROOT_PASSWORD=testPass\n',
                    appPorts: [{ port: 27017 }],
                    id: 'app-id'
                } as AppExtendedModel;

                const databaseModel = AppTemplateUtils.getDatabaseModelFromApp(app);

                expect(databaseModel.databaseName).toBe('testDB');
                expect(databaseModel.username).toBe('testUser');
                expect(databaseModel.password).toBe('testPass');
                expect(databaseModel.port).toBe(27017);
                expect(databaseModel.hostname).toBe(KubeObjectNameUtils.toServiceName('app-id'));
            });

            it('should throw ServiceException for unknown app type', () => {
                const app: AppExtendedModel = {
                    appType: 'UNKNOWN',
                    envVars: '',
                    appPorts: [],
                    id: 'app-id'
                } as any;

                expect(() => AppTemplateUtils.getDatabaseModelFromApp(app)).toThrow(ServiceException);
            });
        });
    });
});