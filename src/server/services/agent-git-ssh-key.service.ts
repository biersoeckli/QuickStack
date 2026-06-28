import dataAccess from "../adapter/db.client";
import { Tags } from "../utils/cache-tag-generator.utils";
import { Constants } from "@/shared/utils/constants";
import { BaseGitSshKeyService } from "./base-git-ssh-key.service";

class AgentGitSshKeyService extends BaseGitSshKeyService {
    constructor() {
        super({
            entityType: 'agent',
            model: dataAccess.client.agentGitSshKey,
            cacheTag: (id: string) => Tags.agent(id),
            annotationKey: Constants.QS_ANNOTATION_AGENT_ID,
            keygenPrefix: 'agent-keygen-',
        });
    }
}

const agentGitSshKeyService = new AgentGitSshKeyService();
export default agentGitSshKeyService;
