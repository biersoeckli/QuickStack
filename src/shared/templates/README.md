# QuickStack Application Templates

This directory contains pre-configured application templates for QuickStack. Templates allow users to quickly deploy common applications and databases with sensible defaults.

## Overview

Templates are TypeScript files that define the complete configuration for one or more applications. They specify container images, environment variables, volumes, ports, and any post-creation configuration needed.

## Template Structure

Each template file exports an `AppTemplateModel` object and optionally a post-create function.

### Basic Template Structure

```typescript
import { AppTemplateModel } from "../../model/app-template.model";
import { Constants } from "@/shared/utils/constants";

export const myAppTemplate: AppTemplateModel = {
    name: "My Application",
    iconName: "myapp.svg",  // or URL: "https://example.com/icon.png"
    templates: [
        {
            inputSettings: [ /* user inputs */ ],
            appModel: { /* app configuration */ },
            appDomains: [ /* domain configuration */ ],
            appVolumes: [ /* volume configuration */ ],
            appFileMounts: [ /* file mounts */ ],
            appPorts: [ /* port configuration */ ]
        }
    ]
};
```

### Key Properties

#### 1. `name` (string)
The display name of the template shown in the UI.

#### 2. `iconName` (string)
Either:
- A filename from `/public/template-icons/` (e.g., `"mysql.svg"`)
- A full URL to an icon (e.g., `"https://avatars.githubusercontent.com/u/158137808"`)

#### 3. `templates` (array)
An array of template configurations. Use multiple templates when your application requires multiple services (e.g., frontend + backend, app + database).

### Template Configuration Object

Each object in the `templates` array contains:

#### `inputSettings` (array)
User-configurable values that will be prompted during creation:

```typescript
inputSettings: [
    {
        key: "containerImageSource",           // Must match a property in appModel
        label: "Container Image",              // Display label in UI
        value: "postgres:16",                  // Default value
        isEnvVar: false,                       // If true, adds to envVars; if false, sets app property
        randomGeneratedIfEmpty: false,         // If true, generates random string when empty
    },
    {
        key: "POSTGRES_PASSWORD",
        label: "Database Password",
        value: "",
        isEnvVar: true,                        // Will be added to envVars as "POSTGRES_PASSWORD=..."
        randomGeneratedIfEmpty: true,          // Will generate secure random password if left empty
    }
]
```

**Key field behavior:**
- If `isEnvVar: false`, the key must match a field in `appModel` (e.g., `containerImageSource`, `name`, `replicas`)
- If `isEnvVar: true`, the key will be used as an environment variable name

**Random generation:**
- When `randomGeneratedIfEmpty: true`, empty values will be replaced with a secure random string
- Useful for passwords, secret keys, and tokens

#### `appModel` (object)
Core application configuration:

```typescript
appModel: {
    name: "PostgreSQL",                       // Default name (user can override)
    appType: 'DATABASE' | 'APP',              // Type of application
    sourceType: 'CONTAINER',                  // Always 'CONTAINER' for templates
    containerImageSource: "",                 // Will be set from inputSettings
    replicas: 1,                              // Number of replicas

    // Network policies
    ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
    egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
    useNetworkPolicy: true,

    // Environment variables (string with KEY=VALUE pairs, one per line)
    envVars: `POSTGRES_DB=mydb
POSTGRES_USER=admin`,

    // Health checks
    healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
    healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
    healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
}
```

**Important:**
- `envVars` is a multi-line string with KEY=VALUE format
- Values from `inputSettings` with `isEnvVar: true` will be automatically appended
- Use `Constants.DEFAULT_*` values for network policies and health checks

#### `appDomains` (array)
Domain configurations (usually empty for templates, users configure later):

```typescript
appDomains: []
```

#### `appVolumes` (array)
Persistent volume configurations:

```typescript
appVolumes: [
    {
        size: 10000,                          // Size in MB (10GB = 10000MB)
        containerMountPath: '/var/lib/postgresql/data',
        accessMode: 'ReadWriteOnce',          // 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany'
        storageClassName: 'longhorn',          // Storage class (usually 'longhorn')
        shareWithOtherApps: false,            // Whether volume can be shared
    }
]
```

#### `appFileMounts` (array)
File mount configurations (usually empty unless specific files need to be mounted):

```typescript
appFileMounts: []
```

#### `appPorts` (array)
Port configurations:

```typescript
appPorts: [
    {
        port: 5432,                           // Container port to expose
    }
]
```

## Multi-Service Templates

When an application requires multiple services (e.g., Ollama + Open WebUI), define multiple objects in the `templates` array.

### Example: Open WebUI with Ollama Backend

```typescript
export const openwebuiAppTemplate: AppTemplateModel = {
    name: "Open WebUI",
    iconName: 'https://avatars.githubusercontent.com/u/158137808',
    templates: [
        {
            // First service: Ollama backend
            inputSettings: [
                {
                    key: "containerImageSource",
                    label: "Container Image",
                    value: "ollama/ollama:latest",
                    isEnvVar: false,
                    randomGeneratedIfEmpty: false,
                },
            ],
            appModel: {
                name: "Ollama",
                appType: 'APP',
                sourceType: 'CONTAINER',
                containerImageSource: "",
                replicas: 1,
                envVars: `OLLAMA_HOST=0.0.0.0
OLLAMA_ORIGINS=*`,
                // ... other configuration
            },
            appVolumes: [{
                size: 10000,
                containerMountPath: '/root/.ollama',
                accessMode: 'ReadWriteOnce',
                storageClassName: 'longhorn',
                shareWithOtherApps: false,
            }],
            appPorts: [{
                port: 11434,
            }]
        },
        {
            // Second service: Open WebUI frontend
            inputSettings: [
                {
                    key: "containerImageSource",
                    label: "Container Image",
                    value: "ghcr.io/open-webui/open-webui:main",
                    isEnvVar: false,
                    randomGeneratedIfEmpty: false,
                },
                {
                    key: "WEBUI_SECRET_KEY",
                    label: "Secret Key",
                    value: "",
                    isEnvVar: true,
                    randomGeneratedIfEmpty: true,  // Auto-generates if empty
                },
            ],
            appModel: {
                name: "Open WebUI",
                appType: 'APP',
                sourceType: 'CONTAINER',
                containerImageSource: "",
                replicas: 1,
                envVars: ``,  // Will be populated by post-create function
                // ... other configuration
            },
            appVolumes: [{
                size: 2000,
                containerMountPath: '/app/backend/data',
                accessMode: 'ReadWriteOnce',
                storageClassName: 'longhorn',
                shareWithOtherApps: false,
            }],
            appPorts: [{
                port: 8080,
            }]
        }
    ]
};
```

## Using Database Templates in Multi-Service Apps

QuickStack provides reusable database template functions that you can use in your multi-service templates. Instead of manually defining database configurations, use these helper functions with custom parameters.

### Available Database Template Functions

All database templates export both:
1. A `getXXXAppTemplate()` function for custom configurations
2. An `xxxAppTemplate` constant for standalone use (which internally uses the function with defaults)

**Functions available:**

- `getPostgresAppTemplate(config?)` - PostgreSQL database
- `getMongodbAppTemplate(config?)` - MongoDB database
- `getMysqlAppTemplate(config?)` - MySQL database
- `getMariadbAppTemplate(config?)` - MariaDB database
- `getRedisAppTemplate(config?)` - Redis cache

**Example of both exports:**
```typescript
// From databases/postgres.template.ts:
export function getPostgresAppTemplate(config?) { /* ... */ }  // Function for custom config
export const postgreAppTemplate: AppTemplateModel = {          // Constant for standalone use
    name: "PostgreSQL",
    iconName: 'postgres.svg',
    templates: [getPostgresAppTemplate()]  // Uses function with defaults
};
```

### Function Parameters

Each function accepts an optional configuration object to customize the database:

#### PostgreSQL, MongoDB
```typescript
config?: {
    appName?: string,      // Custom name (e.g., "My App PostgreSQL")
    dbName?: string,       // Database name
    dbUsername?: string,   // Database username
    dbPassword?: string    // Database password (leave empty to auto-generate)
}
```

#### MySQL, MariaDB
```typescript
config?: {
    appName?: string,      // Custom name
    dbName?: string,       // Database name
    dbUsername?: string,   // Database username
    dbPassword?: string,   // Database password (leave empty to auto-generate)
    rootPassword?: string  // Root password (leave empty to auto-generate)
}
```

#### Redis
```typescript
config?: {
    appName?: string      // Custom name (e.g., "Cache Redis")
}
```

### Example: Docmost with PostgreSQL and Redis

See the complete implementation in [`apps/docmost.template.ts`](apps/docmost.template.ts).

**Key highlights:**
- Uses `getPostgresAppTemplate()` with custom database name and username
- Uses `getRedisAppTemplate()` with custom app name
- Implements `postCreateDocmostAppTemplate()` to:
  - Call `postCreateRedisAppTemplate()` to set up Redis password
  - Use `AppTemplateUtils.getDatabaseModelFromApp()` to extract connection info
  - Build connection URLs with `.internalConnectionUrl` property (includes passwords)
  - Set environment variables for the main Docmost app

### Benefits of Using Database Template Functions

1. **Consistency**: All database configurations use the same tested patterns
2. **Less Code**: No need to manually define volumes, ports, health checks
3. **Flexibility**: Override only the values you need to customize
4. **Maintainability**: Database configuration updates happen in one place
5. **Best Practices**: Functions include proper network policies, health checks, and defaults

### Extracting Database Connection Information

Use `AppTemplateUtils.getDatabaseModelFromApp()` to extract database credentials and connection URLs in post-create functions:

```typescript
import { AppTemplateUtils } from "@/server/utils/app-template.utils";

const dbInfo = AppTemplateUtils.getDatabaseModelFromApp(postgresApp);
// Returns: {
//   hostname: "svc-app-xyz",
//   port: 5432,
//   username: "dbuser",
//   password: "generated-password",
//   databaseName: "mydb",
//   internalConnectionUrl: "postgresql://dbuser:password@svc-app-xyz:5432/mydb"
// }

// Use the connection URL directly
docmostApp.envVars = `DATABASE_URL=${dbInfo.internalConnectionUrl}`;
```

**Supported databases:** PostgreSQL, MySQL, MariaDB, MongoDB, Redis

**Note:** For Redis with password, the password is automatically included in the URL format: `redis://:password@hostname:port`

### When to Use Database Template Functions

- ✅ Multi-service templates that need databases (e.g., app + PostgreSQL)
- ✅ Custom database names/credentials for specific applications
- ✅ Reducing boilerplate in template definitions
- ❌ Standalone database templates (use the exported constants instead)

## Post-Creation Configuration

When apps need to reference each other (e.g., frontend needs backend URL), use a post-create function.

### Post-Create Function Structure

```typescript
import { AppExtendedModel } from "@/shared/model/app-extended.model";
import { KubeObjectNameUtils } from "@/server/utils/kube-object-name.utils";

export const postCreateMyAppTemplate = async (
    createdApps: AppExtendedModel[]
): Promise<AppExtendedModel[]> => {
    // createdApps array matches the order of templates array
    const backendApp = createdApps[0];
    const frontendApp = createdApps[1];

    if (!backendApp || !frontendApp) {
        throw new Error('Created templates not found.');
    }

    // Get internal Kubernetes service hostname
    const backendHostname = KubeObjectNameUtils.toServiceName(backendApp.id);

    // Update frontend app configuration
    frontendApp.envVars += `BACKEND_URL=http://${backendHostname}:8080`;

    // Return modified apps (order must match input)
    return [backendApp, frontendApp];
};
```

### Registering Post-Create Functions

Add your post-create function to `all.templates.ts`:

```typescript
import { postCreateMyAppTemplate } from "./apps/myapp.template";

export const postCreateTemplateFunctions: Map<
    string,
    (createdApps: AppExtendedModel[]) => Promise<AppExtendedModel[]>
> = new Map([
    [myAppTemplate.name, postCreateMyAppTemplate],  // Key is template name
]);
```

**Important:**
- The function receives apps in the same order as defined in `templates` array
- Use `KubeObjectNameUtils.toServiceName(appId)` to get internal Kubernetes DNS names
- Format for internal URLs: `http://{serviceName}:{port}`
- Always return the full array of apps, even if some weren't modified
- Validate that all expected apps exist before processing

## Utility Functions

### `KubeObjectNameUtils.toServiceName(appId: string)`
Generates the internal Kubernetes service name for inter-app communication.

```typescript
const serviceName = KubeObjectNameUtils.toServiceName(appId);
// Result: "svc-app-myapp-a1b2c3d4"
// Use in URLs: `http://${serviceName}:8080`
```

## Adding a New Template

1. **Create template file** in `apps/` or `databases/` directory:
   ```typescript
   // src/shared/templates/apps/myapp.template.ts
   export const myAppTemplate: AppTemplateModel = { /* ... */ };

   // Optional: Post-create function if needed
   export const postCreateMyAppTemplate = async (createdApps) => { /* ... */ };
   ```

2. **Import in `all.templates.ts`**:
   ```typescript
   import { myAppTemplate } from "./apps/myapp.template";

   export const appTemplates: AppTemplateModel[] = [
       // ... existing templates
       myAppTemplate
   ];
   ```

3. **Register post-create function** (if exists):
   ```typescript
   export const postCreateTemplateFunctions: Map<...> = new Map([
       // ... existing functions
       [myAppTemplate.name, postCreateMyAppTemplate]
   ]);
   ```

4. **Add icon** (optional):
   - Place SVG/PNG in `/public/template-icons/myapp.svg`
   - Or use direct URL in `iconName` field

## Common Patterns

### Database Template Pattern

```typescript
export const mydatabaseAppTemplate: AppTemplateModel = {
    name: "MyDatabase",
    iconName: "mydatabase.svg",
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "mydatabase:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "DB_PASSWORD",
                label: "Database Password",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "MyDatabase",
            appType: 'DATABASE',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES,
            envVars: `DB_USER=admin`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 5000,
            containerMountPath: '/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3306,
        }]
    }]
};
```

### Application Template Pattern

```typescript
export const myappAppTemplate: AppTemplateModel = {
    name: "My Application",
    iconName: "myapp.svg",
    templates: [{
        inputSettings: [
            {
                key: "containerImageSource",
                label: "Container Image",
                value: "myapp:latest",
                isEnvVar: false,
                randomGeneratedIfEmpty: false,
            },
            {
                key: "APP_SECRET",
                label: "Application Secret",
                value: "",
                isEnvVar: true,
                randomGeneratedIfEmpty: true,
            },
        ],
        appModel: {
            name: "My Application",
            appType: 'APP',
            sourceType: 'CONTAINER',
            containerImageSource: "",
            replicas: 1,
            ingressNetworkPolicy: Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS,
            egressNetworkPolicy: Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS,
            envVars: `NODE_ENV=production`,
            useNetworkPolicy: true,
            healthCheckPeriodSeconds: Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS,
            healthCheckTimeoutSeconds: Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS,
            healthCheckFailureThreshold: Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD,
        },
        appDomains: [],
        appVolumes: [{
            size: 1000,
            containerMountPath: '/app/data',
            accessMode: 'ReadWriteOnce',
            storageClassName: 'longhorn',
            shareWithOtherApps: false,
        }],
        appFileMounts: [],
        appPorts: [{
            port: 3000,
        }]
    }]
};
```

## Best Practices

1. **Use Database Template Functions**: For multi-service templates, use `getPostgresAppTemplate()`, `getMongodbAppTemplate()`, etc. instead of manually defining database configurations
2. **Use Constants**: Always use `Constants.DEFAULT_*` values for network policies and health checks
3. **Random Passwords**: Use `randomGeneratedIfEmpty: true` for sensitive values like passwords
4. **Clear Labels**: Make `inputSettings` labels user-friendly and descriptive
5. **Sensible Defaults**: Provide good default values for container images and other settings
6. **Volume Sizes**: Choose appropriate default volume sizes (in MB)
7. **Port Configuration**: Always specify the main container port(s)
8. **Post-Create Functions**: Required when apps need to reference each other (see Docmost example)
9. **Error Handling**: Always validate app existence in post-create functions
10. **Internal URLs**: Use `KubeObjectNameUtils.toServiceName()` for inter-service communication
11. **Icon Assets**: Prefer SVG icons in `/public/template-icons/` for consistency

## Constants Reference

```typescript
// Network Policies
Constants.DEFAULT_INGRESS_NETWORK_POLICY_APPS
Constants.DEFAULT_EGRESS_NETWORK_POLICY_APPS
Constants.DEFAULT_INGRESS_NETWORK_POLICY_DATABASES
Constants.DEFAULT_EGRESS_NETWORK_POLICY_DATABASES

// Health Checks
Constants.DEFAULT_HEALTH_CHECK_PERIOD_SECONDS
Constants.DEFAULT_HEALTH_CHECK_TIMEOUT_SECONDS
Constants.DEFAULT_HEALTH_CHECK_FAILURE_THRESHOLD
```

## Testing Your Template

1. Start the QuickStack development server
2. Navigate to a project
3. Click "Create from Template"
4. Select "Database" or "App" tab based on your template type
5. Find and select your template
6. Fill in the configuration form
7. Click "Create" and verify the app(s) are created correctly
8. If using post-create function, verify environment variables are set correctly
9. Deploy the app(s) and verify they start successfully

## Example Files

Reference these existing templates for more examples:
- **Standalone Database**: `databases/postgres.template.ts`
- **Database Template Function**: See any `getXXXAppTemplate()` in `databases/` directory
- **Multi-Service with Databases**: `apps/docmost.template.ts` (PostgreSQL + Redis + App)
- **Multi-Service with Post-Create**: `apps/openwebui.template.ts` (Ollama + Open WebUI)
- **Complex Configuration**: `apps/immich.template.ts`
