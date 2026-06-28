import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Constants } from "@/shared/utils/constants";
import { BaseGitSshKeyService } from "./base-git-ssh-key.service";

export { GIT_SSH_PRIVATE_KEY_SECRET_KEY } from "./base-git-ssh-key.service";

class AppGitSshKeyService extends BaseGitSshKeyService {
    constructor() {
        super({
            entityType: 'app',
            model: dataAccess.client.appGitSshKey,
            cacheTag: (id: string) => Tags.app(id),
            annotationKey: Constants.QS_ANNOTATION_APP_ID,
            keygenPrefix: 'keygen-',
        });
    }
}

const appGitSshKeyService = new AppGitSshKeyService();
export default appGitSshKeyService;
