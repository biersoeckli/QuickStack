import dataAccess from "../../adapter/db.client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import quickStackService from "../qs.service";
import { adminRoleName } from "../../../shared/model/role-extended.model";

class PasswordChangeService {

    async changeAdminPasswordAndPrintNewPassword() {
        const firstCreatedUser = await dataAccess.client.user.findFirst({
            where: {
                userGroup: {
                    name: adminRoleName
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        if (!firstCreatedUser) {
            console.error("No admin users found. QuickStack is not configured yet. Open your browser to setup quickstack");
            return;
        }

        const generatedPassword = randomBytes(20).toString('hex');
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        await dataAccess.client.user.update({
            where: {
                id: firstCreatedUser.id
            },
            data: {
                password: hashedPassword,
                twoFaSecret: null,
                twoFaEnabled: false
            }
        });

        console.log(``);
        console.log(``);
        console.log('*******************************');
        console.log('******* Password change *******');
        console.log('*******************************');
        console.log(``);
        console.log(`New password for admin user ${firstCreatedUser.email} is: ${generatedPassword}`);
        console.log(``);
        console.log('*******************************');
        console.log('*******************************');
        console.log('*******************************');
        console.log(``);
        console.log(``);
        console.log(`Restarting QuickStack, please wait...`);
        console.log(``);
        console.log(``);

        const existingDeployment = await quickStackService.getExistingDeployment();
        await quickStackService.createOrUpdateDeployment(existingDeployment.nextAuthSecret, existingDeployment.isCanaryDeployment ? 'canary' : 'latest');
        await new Promise(resolve => setTimeout(resolve, 60000)); // wait 60 seconds, so that pod is not restarted and sets the new password again
    }
}
const passwordChangeService = new PasswordChangeService();
export default passwordChangeService;