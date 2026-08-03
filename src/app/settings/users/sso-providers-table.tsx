"use client";

import { Button } from "@/components/ui/button";
import { EditIcon, Plus, TrashIcon } from "lucide-react";
import { SimpleDataTable } from "@/components/custom/simple-data-table";
import { formatDateTime } from "@/frontend/utils/format.utils";
import { Toast } from "@/frontend/utils/toast.utils";
import { useConfirmDialog } from "@/frontend/states/zustand.states";
import { deleteSsoProvider } from "./actions";
import SsoProviderEditOverlay from "./sso-provider-edit-overlay";
import { SsoProviderUiModel } from "@/shared/model/sso-provider.model";
import { UserGroupExtended } from "@/shared/model/sim-session.model";

export default function SsoProvidersTable({
  ssoProviders,
  userGroups,
}: {
  ssoProviders: SsoProviderUiModel[];
  userGroups: UserGroupExtended[];
}) {
  const { openConfirmDialog } = useConfirmDialog();
  async function remove(id: string) {
    if (
      await openConfirmDialog({
        title: "Delete SSO Provider",
        description: "Remove this provider? Existing linked accounts remain, but new login attempts cannot use it.",
        okButton: "Delete",
      })
    ) {
      await Toast.fromAction(() => deleteSsoProvider(id));
    }
  }
  return (
    <>
      <SimpleDataTable
        columns={[
          ["id", "Provider ID", false],
          ["type", "Type", true],
          ["name", "Display Name", true],
          ["enabled", "Enabled", true, (item) => (item.enabled ? "Yes" : "No")],
          ["defaultUserGroupId", "Default Group", true, (item) =>
            userGroups.find((group) => group.id === item.defaultUserGroupId)?.name ?? "—",
          ],
          ["createdAt", "Created", false, (item) => formatDateTime(item.createdAt)],
        ]}
        data={ssoProviders}
        actionCol={(item) => (
          <div className="flex">
            <div className="flex-1" />
            <SsoProviderEditOverlay provider={item} userGroups={userGroups}>
              <Button variant="ghost">
                <EditIcon />
              </Button>
            </SsoProviderEditOverlay>
            <Button variant="ghost" onClick={() => remove(item.id)}>
              <TrashIcon />
            </Button>
          </div>
        )}
      />
      <SsoProviderEditOverlay userGroups={userGroups}>
        <Button variant="secondary">
          <Plus /> Add SSO Provider
        </Button>
      </SsoProviderEditOverlay>
    </>
  );
}
