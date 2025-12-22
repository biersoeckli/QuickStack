export class Constants {
    static readonly QS_ANNOTATION_APP_ID = 'qs-app-id';
    static readonly QS_ANNOTATION_PROJECT_ID = 'qs-project-id';
    static readonly QS_ANNOTATION_CONTAINER_TYPE = 'qs-containter-type';
    static readonly QS_ANNOTATION_CONTAINER_TYPE_DB_BACKUP_JOB = 'qs-job-database-backup';
    static readonly QS_ANNOTATION_CONTAINER_TYPE_DB_TOOL = 'qs-container-db-tool';
    static readonly QS_ANNOTATION_DEPLOYMENT_ID = 'qs-deplyoment-id';
    static readonly QS_ANNOTATION_GIT_COMMIT = 'qs-git-commit';
    static readonly K3S_JOIN_TOKEN = 'k3sJoinToken';
    static readonly QS_NAMESPACE = 'quickstack';
    static readonly QS_APP_NAME = 'quickstack';
    static readonly INTERNAL_REGISTRY_LOCATION = 'internal-registry-location';
    static readonly TRAEFIK_ME_SECRET_NAME = 'traefik-me-tls';
    static readonly QS_SYSTEM_BACKUP_DEACTIVATED = 'deactivated';
    static readonly QS_SYSTEM_BACKUP_LOCATION_PARAM_KEY = 'qsSystemBackupLocation';
    static readonly DEFAULT_INGRESS_NETWORK_POLICY_APPS = 'ALLOW_ALL';
    static readonly DEFAULT_EGRESS_NETWORK_POLICY_APPS = 'ALLOW_ALL';
    static readonly DEFAULT_INGRESS_NETWORK_POLICY_DATABASES = 'NAMESPACE_ONLY';
    static readonly DEFAULT_EGRESS_NETWORK_POLICY_DATABASES = 'DENY_ALL';
}