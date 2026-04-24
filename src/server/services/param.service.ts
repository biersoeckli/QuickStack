import { revalidateTag, unstable_cache } from "next/cache";
import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Parameter, Prisma } from "@prisma/client";
import { Constants } from "../../shared/utils/constants";

export class ParamService {

    static readonly QS_SERVER_HOSTNAME = 'qsServerHostname';
    static readonly DISABLE_NODEPORT_ACCESS = 'disableNodePortAccess';
    static readonly LETS_ENCRYPT_MAIL = 'letsEncryptMail';
    static readonly USE_CANARY_CHANNEL = 'useCanaryChannel';
    static readonly REGISTRY_SOTRAGE_LOCATION = 'registryStorageLocation';
    static readonly PUBLIC_IPV4_ADDRESS = 'publicIpv4Address';
    static readonly QS_SYSTEM_BACKUP_LOCATION = Constants.QS_SYSTEM_BACKUP_LOCATION_PARAM_KEY;
    static readonly K3S_JOIN_TOKEN = Constants.K3S_JOIN_TOKEN;
    static readonly BUILD_MEMORY_LIMIT = 'buildMemoryLimit';
    static readonly BUILD_MEMORY_RESERVATION = 'buildMemoryReservation';
    static readonly BUILD_CPU_LIMIT = 'buildCpuLimit';
    static readonly BUILD_CPU_RESERVATION = 'buildCpuReservation';
    static readonly BUILD_NODE = 'buildNode';
    static readonly QS_INSTANCE_ID = 'qsInstanceId';

    async getUncached(name: string) {
        return await dataAccess.client.parameter.findFirstOrThrow({
            where: {
                name
            }
        });
    }

    async get(name: string) {
        return await unstable_cache(async (name: string) => await this.getUncached(name),
            [Tags.parameter()], {
            tags: [Tags.parameter()],
            revalidate: 3600
        })(name);
    }

    async getOrUndefinedUncached(name: string) {
        return await dataAccess.client.parameter.findUnique({
            where: {
                name
            }
        });
    }

    async getOrCreate(name: string, defaultValue: string) {
        let param: Parameter;
        try {
            param = await dataAccess.client.parameter.upsert({
                where: {
                    name
                },
                create: {
                    name,
                    value: defaultValue
                },
                update: {}
            });
        } finally {
            revalidateTag(Tags.parameter());
        }
        return param;
    }

    async getOrUndefined(name: string) {
        return await unstable_cache(async (name: string) => await this.getOrUndefinedUncached(name),
            [Tags.parameter()], {
            tags: [Tags.parameter()],
            revalidate: 3600
        })(name);
    }

    async getBoolean(name: string, defaultValue?: boolean) {
        const param = await this.getOrUndefined(name);
        if (param) {
            return param.value === 'true';
        }
        if (defaultValue) {
            await this.save({
                name,
                value: defaultValue.toString()
            });
            return defaultValue;
        }
        return undefined;
    }

    async getString(name: string, defaultValue?: string) {
        const param = await this.getOrUndefined(name);
        if (param) {
            return param.value;
        }
        if (defaultValue) {
            await this.save({
                name,
                value: defaultValue
            });
            return defaultValue;
        }
        return undefined;
    }

    async getNumber(name: string, defaultValue?: number) {
        const param = await this.getOrUndefined(name);
        if (param) {
            return Number(param.value);
        }
        if (defaultValue) {
            await this.save({
                name,
                value: defaultValue.toString()
            });
            return defaultValue;
        }
        return undefined;
    }

    async deleteByName(name: string) {
        const existingParam = await this.get(name);
        if (!existingParam) {
            return;
        }
        try {
            await dataAccess.client.parameter.delete({
                where: {
                    name
                }
            });
        } finally {
            revalidateTag(Tags.parameter());
        }
    }

    async deleteByNameIfExists(name: string) {
        const existingParam = await this.getOrUndefined(name);
        if (!existingParam) {
            return;
        }
        try {
            await dataAccess.client.parameter.delete({
                where: {
                    name
                }
            });
        } finally {
            revalidateTag(Tags.parameter());
        }
    }

    async getAllParams() {
        return await unstable_cache(async () => await dataAccess.client.parameter.findMany(),
            [Tags.parameter()], {
            tags: [Tags.parameter()],
            revalidate: 3600
        })();
    }


    async save(item: Prisma.ParameterUncheckedCreateInput | Prisma.ParameterUncheckedUpdateInput) {
        let savedItem: Parameter;
        try {
            savedItem = await dataAccess.client.parameter.upsert({
                where: {
                    name: item.name as string
                },
                create: item as Prisma.ParameterUncheckedCreateInput,
                update: {
                    value: item.value
                } as Prisma.ParameterUncheckedUpdateInput
            });
        } finally {
            revalidateTag(Tags.parameter());
        }
        return savedItem;
    }

}

const paramService = new ParamService();
export default paramService;
