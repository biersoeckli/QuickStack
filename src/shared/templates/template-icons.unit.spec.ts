import { allTemplates, appTemplates, databaseTemplates } from '@/shared/templates/all.templates';
import { AppTemplateModel } from '@/shared/model/app-template.model';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('Template Icons', () => {
    describe('Local icon validation', () => {
        const checkTemplateIcon = (template: AppTemplateModel) => {
            const { name, iconName } = template;

            // Check if iconName exists
            expect(iconName).toBeDefined();
            expect(typeof iconName).toBe('string');

            if (!iconName) return;

            expect(iconName).not.toMatch(/^https?:\/\//);
            expect(iconName.length).toBeGreaterThan(0);
            expect(iconName).toMatch(/\.(svg|png|jpg|jpeg|gif|ico|webp)$/i);
            expect(existsSync(join(process.cwd(), 'public/template-icons', iconName))).toBe(true);
        };

        test('All database templates should have local icons', () => {
            databaseTemplates.forEach(template => {
                checkTemplateIcon(template);
            });
        });

        test('All app templates should have local icons', () => {
            appTemplates.forEach(template => {
                checkTemplateIcon(template);
            });
        });

        test('No duplicate template names', () => {
            const names = allTemplates.map(t => t.name);
            const uniqueNames = new Set(names);
            expect(names.length).toBe(uniqueNames.size);
        });

        test('All templates should have non-empty names', () => {
            allTemplates.forEach(template => {
                expect(template.name).toBeDefined();
                expect(template.name.length).toBeGreaterThan(0);
            });
        });

        test('All templates should have non-empty descriptions', () => {
            allTemplates.forEach(template => {
                expect(template.description).toBeDefined();
                expect(template.description?.length).toBeGreaterThan(0);
            });
        });

        test('All templates should have valid website URLs', () => {
            allTemplates.forEach(template => {
                expect(template.websiteUrl).toMatch(/^https:\/\//);
            });
        });
    });

    describe('Template Structure', () => {
        test('All templates should have at least one template configuration', () => {
            allTemplates.forEach(template => {
                expect(template.templates).toBeDefined();
                expect(Array.isArray(template.templates)).toBe(true);
                expect(template.templates.length).toBeGreaterThan(0);
            });
        });

        test('All template configurations should have required fields', () => {
            allTemplates.forEach(template => {
                template.templates.forEach((config) => {
                    expect(config.inputSettings).toBeDefined();
                    expect(config.appModel).toBeDefined();
                    expect(config.appDomains).toBeDefined();
                    expect(config.appVolumes).toBeDefined();
                    expect(config.appFileMounts).toBeDefined();
                });
            });
        });
    });

});
