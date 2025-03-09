'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useFormState } from 'react-dom'
import { useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { saveRole } from "./actions"
import { RoleExtended, RolePermissionEnum } from "@/shared/model/role-extended.model.ts"
import { RoleEditModel, roleEditZodModel } from "@/shared/model/role-edit.model"
import { App } from "@prisma/client"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppWithProjectModel } from "@/shared/model/app-extended.model"

export default function RoleEditOverlay({ children, role, apps }: {
  children: React.ReactNode;
  role?: RoleExtended;
  apps: AppWithProjectModel[]
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [appPermissions, setAppPermissions] = useState<{
    appId: string;
    read: boolean;
    readwrite: boolean;
  }[]>([]);

  const form = useForm<RoleEditModel>({
    resolver: zodResolver(roleEditZodModel),
    defaultValues: role
  });

  const [state, formAction] = useFormState((state: ServerActionResult<any, any>,
    payload: RoleEditModel) =>
    saveRole(state, {
      ...payload,
      id: role?.id,
      roleAppPermissions: appPermissions.flatMap(perm => {
        if (!perm.read && !perm.readwrite) return [];
        return [{
          appId: perm.appId,
          permission: perm.readwrite ? RolePermissionEnum.READWRITE : RolePermissionEnum.READ
        }];
      })
    }), FormUtils.getInitialFormState<typeof roleEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('Role saved successfully');
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof roleEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    if (role) {
      form.reset(role);

      // Initialize app permissions based on role data
      const initialPermissions = apps.map(app => {
        const existingPermission = role.roleAppPermissions?.find(p => p.appId === app.id);
        return {
          appId: app.id,
          read: !!existingPermission && (existingPermission.permission === RolePermissionEnum.READ || existingPermission.permission === RolePermissionEnum.READWRITE),
          readwrite: !!existingPermission && existingPermission.permission === RolePermissionEnum.READWRITE
        };
      });

      setAppPermissions(initialPermissions);
    } else {
      // Initialize with all apps having no permissions
      const initialPermissions = apps.map(app => ({
        appId: app.id,
        read: false,
        readwrite: false
      }));

      setAppPermissions(initialPermissions);
    }
  }, [role, apps]);

  const handleReadChange = (appId: string, checked: boolean) => {
    setAppPermissions(prev => prev.map(perm => {
      if (perm.appId === appId) {
        // If read is being turned off, also turn off readwrite
        if (!checked) {
          return { ...perm, read: false, readwrite: false };
        }
        // If read is being turned on, just update read
        return { ...perm, read: checked };
      }
      return perm;
    }));
  };

  const handleReadWriteChange = (appId: string, checked: boolean) => {
    setAppPermissions(prev => prev.map(perm => {
      if (perm.appId === appId) {
        // If readwrite is being turned on, also turn on read
        if (checked) {
          return { ...perm, read: true, readwrite: true };
        }
        // If readwrite is being turned off, just update readwrite
        return { ...perm, readwrite: false };
      }
      return perm;
    }));
  };

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(isOpened)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{role?.id ? 'Edit' : 'Create'} Role</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-3">
              <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                  return formAction(data);
                })()}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="canCreateNewApps"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Can create new apps
                            </FormLabel>
                            <FormDescription>
                              If enabled, users with this role can create new apps. Projects can only be created by admins.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="canAccessBackups"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Can access backups
                            </FormLabel>
                            <FormDescription>
                              If enabled, users can access the backups page and download backups from all apps.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="pt-3">
                      <h3 className="text-sm font-medium mb-2">App Permissions</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>App</TableHead>
                            <TableHead>Read</TableHead>
                            <TableHead>ReadWrite</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {apps.map((app) => {
                            const permission = appPermissions.find(p => p.appId === app.id);
                            return (
                              <TableRow key={app.id}>
                                <TableCell>{app.project.name}</TableCell>
                                <TableCell>{app.name}</TableCell>
                                <TableCell>
                                  <Checkbox
                                    id={`read-${app.id}`}
                                    disabled={permission?.readwrite}
                                    checked={permission?.read || false}
                                    onCheckedChange={(checked) => handleReadChange(app.id, !!checked)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Checkbox
                                    id={`readwrite-${app.id}`}
                                    checked={permission?.readwrite || false}
                                    onCheckedChange={(checked) => handleReadWriteChange(app.id, !!checked)}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="text-red-500">{state.message}</p>
                    <SubmitButton>Save</SubmitButton>
                  </div>
                </form>
              </Form >
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog >
    </>
  )
}