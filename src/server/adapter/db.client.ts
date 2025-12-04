import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { ListUtils } from "../../shared/utils/list.utils";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { DefaultArgs } from "@prisma/client/runtime/client";

type clientType = keyof PrismaClient<Prisma.PrismaClientOptions, never | undefined>;

const prismaClientSingleton = () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not defined in environment variables');
    }
    const adapter = new PrismaBetterSqlite3({
        url: process.env.DATABASE_URL,
    });
    return new PrismaClient({ adapter });
}

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

type PrismaTransactionType = Omit<PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>, "$on" | "$connect" | "$disconnect" | "$use" | "$transaction" | "$extends">;


export class DataAccessClient {
    client = prisma;


    async updateManyItems<TEntityType, TKey>(tableName: keyof PrismaTransactionType, itemsToUpdate: TEntityType[],
        primaryKeySelector: (item: TEntityType) => TKey) {
        this.client.$transaction(async (tx) => {
            await this.updateManyItemsWithExistingTransaction(tableName, itemsToUpdate, primaryKeySelector, tx);
        });
    }

    async updateManyItemsWithExistingTransaction<TEntityType, TKey>(tableName: keyof PrismaTransactionType, itemsToUpdate: TEntityType[],
        primaryKeySelector: (item: TEntityType) => TKey, transaction: PrismaTransactionType, primaryKeyField: keyof TEntityType = 'id' as keyof TEntityType) {
        for (const chunk of ListUtils.chunk(itemsToUpdate, 50)) {
            await Promise.all(chunk.map(async dataItem => {
                await (transaction[tableName] as any).update({
                    where: {
                        [primaryKeyField]: primaryKeySelector(dataItem)
                    },
                    data: dataItem
                });
            }));
        }
    }

    async getById(clientType: clientType, id: any, idKey = 'id') {
        return await (this.client[clientType] as any).findFirstOrThrow({
            where: {
                [idKey as string]: id
            }
        });
    }

    async getByIdOrNull(clientType: clientType, id: any, idKey = 'id') {
        return await (this.client[clientType] as any).findFirst({
            where: {
                [idKey as string]: id
            }
        });
    }

    async save<TEntityType>(clientType: clientType, item: TEntityType, idKey = 'id'): Promise<TEntityType> {
        if (!(item as any)[idKey]) {
            return (await this.client[clientType] as any).create({
                data: item,
            });

        }
        return await (this.client[clientType] as any).update({
            where: {
                [idKey as string]: (item as any)[idKey]
            },
            data: item
        });
    }

    async saveIfNotExists<TEntityType>(clientType: clientType, item: TEntityType, idKey = 'id'): Promise<TEntityType> {
        const existing = await this.getByIdOrNull(clientType, (item as any)[idKey], idKey);
        if (!existing) {
            return (await this.client[clientType] as any).create({
                data: item,
            });

        }
        return await (this.client[clientType] as any).update({
            where: {
                [idKey as string]: (item as any)[idKey]
            },
            data: item
        });
    }
}

const dataAccess = new DataAccessClient();
export default dataAccess;