"use client";

import type { z } from "zod";
import { useActionState, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/custom/submit-button";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model";
import {
  SsoProviderEditModel,
  ssoProviderEditZodModel,
  SsoProviderUiModel,
  ssoProviderTypes,
  formatSsoProviderType,
} from "@/shared/model/sso-provider.model";
import { UserGroupExtended } from "@/shared/model/sim-session.model";
import { saveSsoProvider } from "./actions";
import { useDialog } from "@/frontend/states/zustand.states";
import { useDialogContext } from "@/frontend/states/dialog-context";
import { toast } from "sonner";

function SsoProviderRedirectUrlDialog({ redirectUrl }: { redirectUrl: string }) {
  const { closeDialog } = useDialogContext();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">SSO Provider Created</h3>
        <p className="text-sm text-muted-foreground">
          Add this redirect URL to your identity provider.
        </p>
      </div>
      <Input value={redirectUrl} readOnly />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(redirectUrl)}>
          Copy
        </Button>
        <Button onClick={() => closeDialog(true)}>Close</Button>
      </div>
    </div>
  );
}

export default function SsoProviderEditOverlay({
  children,
  provider,
  userGroups,
}: {
  children: React.ReactNode;
  provider?: SsoProviderUiModel;
  userGroups: UserGroupExtended[];
}) {
  const [open, setOpen] = useState(false);
  const { openDialog } = useDialog();
  const form = useForm<
    z.input<typeof ssoProviderEditZodModel>,
    unknown,
    z.output<typeof ssoProviderEditZodModel>
  >({
    resolver: zodResolver(ssoProviderEditZodModel),
    defaultValues: provider ?? {
      type: "OIDC",
      enabled: false,
      clientSecret: "",
      issuer: "",
      tenantId: "",
    },
  });
  const [state, formAction] = useActionState(
    (state: ServerActionResult<any, any>, payload: SsoProviderEditModel) =>
      saveSsoProvider(state, { ...payload, id: provider?.id }),
    FormUtils.getInitialFormState<typeof ssoProviderEditZodModel>(),
  );
  const type = form.watch("type");
  useEffect(() => {
    form.reset(
      provider
        ? { ...provider, clientSecret: "" }
        : {
          type: "OIDC",
          enabled: false,
          clientSecret: "",
          issuer: "",
          tenantId: "",
        },
    );
  }, [form, provider, open]);
  useEffect(() => {
    if (state.status === "success") {
      toast.success("SSO provider saved");
      setOpen(false);
      if (!provider && state.data?.id) {
        void openDialog(
          <SsoProviderRedirectUrlDialog
            redirectUrl={`${window.location.origin}/api/auth/callback/${state.data.id}`}
          />,
          { maxWidth: "640px" },
        );
      }
    }
    FormUtils.mapValidationErrorsToForm<typeof ssoProviderEditZodModel>(
      state,
      form,
    );
  }, [form, openDialog, provider, state]);
  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{provider ? "Edit" : "Add"} SSO Provider</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              action={() => form.handleSubmit((data) => formAction(data))()}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ssoProviderTypes.map((value) => (
                          <SelectItem key={value} value={value}>
                            {formatSsoProviderType(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Secret</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={
                          provider ? "Leave blank to keep current" : ""
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {type === "OIDC" && (
                <FormField
                  control={form.control}
                  name="issuer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issuer URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://idp.example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {type === "AZURE_AD" && (
                <FormField
                  control={form.control}
                  name="tenantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenant ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="defaultUserGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Group</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>Enabled</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <p className="text-red-500">{state.message}</p>
              <SubmitButton>Save</SubmitButton>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
