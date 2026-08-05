import { LockKeyhole, Package, User } from "lucide-react";
import { IconInput, SecretInput } from "./source-wizard-fields";
import { SourceFormPatch, SourceWizardInput } from "./types";

export function ContainerImageStep({ formData, showCredentials, showPassword, setShowPassword, onChange }: {
    formData: SourceWizardInput;
    showCredentials: boolean;
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    onChange: (patch: SourceFormPatch) => void;
}) {
    return (
        <div className="space-y-4">
            <IconInput
                icon={Package}
                label="Image Name"
                placeholder="ghcr.io/user/imagename:latest"
                value={formData.containerImageSource ?? ''}
                onChange={(event) => onChange({ containerImageSource: event.target.value })}
            />
            {showCredentials && (
                <div className="grid gap-4 md:grid-cols-2">
                    <IconInput
                        icon={User}
                        label="Registry Username"
                        value={formData.containerRegistryUsername ?? ''}
                        onChange={(event) => onChange({ containerRegistryUsername: event.target.value })}
                    />
                    <SecretInput
                        icon={LockKeyhole}
                        label="Registry Password"
                        value={formData.containerRegistryPassword ?? ''}
                        visible={showPassword}
                        onVisibleChange={setShowPassword}
                        onChange={(value) => onChange({ containerRegistryPassword: value })}
                    />
                </div>
            )}
        </div>
    );
}
