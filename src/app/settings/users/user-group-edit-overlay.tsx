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

import { useActionState, useEffect, useState } from "react";
import { FormUtils } from "@/frontend/utils/form.utilts";
import { SubmitButton } from "@/components/custom/submit-button";
import { ServerActionResult } from "@/shared/model/server-action-error-return.model"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { saveRole } from "./actions"
import { RolePermissionEnum } from "@/shared/model/role-extended.model.ts"
import { RoleEditModel, roleEditZodModel } from "@/shared/model/role-edit.model"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProjectExtendedModel } from "@/shared/model/project-extended.model"
import { UserGroupExtended } from "@/shared/model/sim-session.model"


type UiProjectPermission = {
  projectId: string;
  createWorkloads: boolean;
  deleteWorkloads: boolean;
  writeWorkloads: boolean;
  readWorkloads: boolean;
  setPermissionsPerApp: boolean;
  workloadPermissions: {
    workloadId: string;
    workloadName: string;
    permission?: RolePermissionEnum;
  }[];
};

export default function RoleEditOverlay({ children, userGroup, projects }: {
  children: React.ReactNode;
  userGroup?: UserGroupExtended;
  projects: ProjectExtendedModel[]
}) {

  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [projectPermissions, setProjectPermissions] = useState<UiProjectPermission[]>([]);

  const form = useForm<RoleEditModel>({
    resolver: zodResolver(roleEditZodModel),
    defaultValues: userGroup
  });

  const [state, formAction] = useActionState((state: ServerActionResult<any, any>,
    payload: RoleEditModel) =>
    saveRole(state, {
      ...payload,
      id: userGroup?.id,
      roleProjectPermissions: projects.map((project) => {
        const projectPermission = projectPermissions.find((perm) => perm.projectId === project.id);
        if (!projectPermission) {
          return undefined;
        }
        return {
          projectId: project.id,
          createWorkloads: projectPermission.createWorkloads,
          deleteWorkloads: projectPermission.deleteWorkloads,
          writeWorkloads: projectPermission.writeWorkloads,
          readWorkloads: projectPermission.readWorkloads,
          workloadPermissions: projectPermission.workloadPermissions.filter(ap => !!ap.permission).map((appPerm) => {
            return {
              workloadId: appPerm.workloadId,
              permission: appPerm.permission!,
            };
          }),
        }
      }).filter((perm) => perm !== undefined),
    }), FormUtils.getInitialFormState<typeof roleEditZodModel>());

  useEffect(() => {
    if (state.status === 'success') {
      form.reset();
      toast.success('Group saved successfully');
      setIsOpen(false);
    }
    FormUtils.mapValidationErrorsToForm<typeof roleEditZodModel>(state, form);
  }, [state]);

  useEffect(() => {
    if (userGroup) {
      form.reset(userGroup);
      // Initialize app permissions based on role data
      const initialPermissions = projects.map(project => {
        const existingPermission = userGroup.roleProjectPermissions?.find(p => p.projectId === project.id);
        const workloadPermissions = [
          ...project.apps.map(app => ({
            workloadId: app.id,
            workloadName: app.name,
            permission: existingPermission?.workloadPermissions.find(appPerm => appPerm.workloadId === app.id)?.permission
          })),
          ...(project.agents ?? []).map(agent => ({
            workloadId: agent.id,
            workloadName: agent.name,
            permission: existingPermission?.workloadPermissions.find(wp => wp.workloadId === agent.id)?.permission
          }))
        ];
        const hasNoWorkloadPermissionsSet = workloadPermissions.every(appPerm => !appPerm.permission);
        return {
          projectId: project.id,
          createWorkloads: existingPermission?.createWorkloads || false,
          deleteWorkloads: existingPermission?.deleteWorkloads || false,
          writeWorkloads: existingPermission?.writeWorkloads || false,
          readWorkloads: existingPermission?.readWorkloads || false,
          setPermissionsPerApp: (existingPermission?.workloadPermissions.length ?? 0) > 0 || false,
          workloadPermissions: hasNoWorkloadPermissionsSet ? [] : workloadPermissions
        } as UiProjectPermission;
      });
      setProjectPermissions(initialPermissions);
    } else {
      // Initialize with all apps having no permissions
      const initialPermissions = projects.map(project => ({
        projectId: project.id,
        createWorkloads: false,
        deleteWorkloads: false,
        writeWorkloads: false,
        readWorkloads: false,
        setPermissionsPerApp: false,
        workloadPermissions: []
      } as UiProjectPermission));
      setProjectPermissions(initialPermissions);
    }
  }, [userGroup, projects, isOpen]);


  const handleReadChange = (projectId: string, checked: boolean) => {
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.projectId === projectId) {
        return { ...perm, readWorkloads: checked };
      }
      return perm;
    }));
  };

  const handleReadWriteChange = (projectId: string, checked: boolean) => {
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.projectId === projectId) {
        return { ...perm, writeWorkloads: checked, readWorkloads: checked ? true : perm.writeWorkloads };
      }
      return perm;
    }));
  };

  const handleCreateChange = (projectId: string, checked: boolean) => {
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.projectId === projectId) {
        return { ...perm, createWorkloads: checked, readWorkloads: checked ? true : perm.createWorkloads };
      }
      return perm;
    }));
  };

  const handleDeleteChange = (projectId: string, checked: boolean) => {
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.projectId === projectId) {
        return { ...perm, deleteWorkloads: checked, readWorkloads: checked ? true : perm.deleteWorkloads };
      }
      return perm;
    }));
  };

  const handleSetPermissionsPerAppChange = (projectId: string, checked: boolean) => {
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.projectId === projectId) {
        const project = projects.find(p => p.id === projectId);
        const appPermissions = checked ? project?.apps.map(app => ({
          workloadId: app.id,
          workloadName: app.name,
          permission: undefined
        })) || [] : [];
        const agentPermissions = checked ? project?.agents?.map(agent => ({
          workloadId: agent.id,
          workloadName: agent.name,
          permission: undefined
        })) || [] : [];
        return {
          ...perm,
          setPermissionsPerApp: checked,
          workloadPermissions: [...appPermissions, ...agentPermissions],
          createWorkloads: false,
          deleteWorkloads: false,
          writeWorkloads: false,
          readWorkloads: false
        };
      }
      return perm;
    }));
  };

  const handleAppReadChange = (appId: string, checked: boolean) =>
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.workloadPermissions.some(appPerm => appPerm.workloadId === appId)) {
        return {
          ...perm,
          workloadPermissions: perm.workloadPermissions.map(appPerm => {
            if (appPerm.workloadId === appId) {
              return { ...appPerm, permission: checked ? RolePermissionEnum.READ : undefined };
            }
            return appPerm;
          })
        };
      }
      return perm;
    }));

  const handleAppReadWriteChange = (appId: string, checked: boolean) =>
    setProjectPermissions(prev => prev.map(perm => {
      if (perm.workloadPermissions.some(appPerm => appPerm.workloadId === appId)) {
        return {
          ...perm,
          workloadPermissions: perm.workloadPermissions.map(appPerm => {
            if (appPerm.workloadId === appId) {
              return { ...appPerm, permission: checked ? RolePermissionEnum.READWRITE : undefined };
            }
            return appPerm;
          })
        };
      }
      return perm;
    }));

  return (
    <>
      <div onClick={() => setIsOpen(true)}>
        {children}
      </div>
      <Dialog open={!!isOpen} onOpenChange={(isOpened) => setIsOpen(isOpened)}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>{userGroup?.id ? 'Edit' : 'Create'} Group</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="px-3">
              <Form {...form}>
                <form action={(e) => form.handleSubmit((data) => {
                  return formAction(data);
                }, console.error)()}>
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
                      <h3 className="text-sm font-medium mb-2">Workload Permissions</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Individual Permissions</TableHead>
                            <TableHead>Read Workloads</TableHead>
                            <TableHead>Edit/Deploy Workloads</TableHead>
                            <TableHead>Create Workloads</TableHead>
                            <TableHead>Delete Workloads</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projects.map((project) => {
                            const permission = projectPermissions.find(p => p.projectId === project.id);
                            return (
                              <>
                                <TableRow key={project.id} className={(permission?.workloadPermissions.length ?? 0) === 0 ? 'border-b-gray-400' : ''} >
                                  <TableCell className="font-semibold">{project.name}</TableCell>
                                  <TableCell>
                                    <Checkbox
                                      id={`delete-${project.id}`}
                                      checked={permission?.setPermissionsPerApp || false}
                                      onCheckedChange={(checked) => handleSetPermissionsPerAppChange(project.id, !!checked)}
                                    />
                                  </TableCell>
                                  {permission?.setPermissionsPerApp ?
                                    <TableHead>Workload</TableHead>
                                    : <TableCell>
                                      <Checkbox
                                        id={`read-${project.id}`}
                                        disabled={permission?.writeWorkloads || permission?.deleteWorkloads || permission?.createWorkloads}
                                        checked={permission?.readWorkloads || false}
                                        onCheckedChange={(checked) => handleReadChange(project.id, !!checked)}
                                      />
                                    </TableCell>}
                                  <TableCell>
                                    {!permission?.setPermissionsPerApp &&
                                      <Checkbox
                                        id={`write-${project.id}`}
                                        checked={permission?.writeWorkloads || false}
                                        onCheckedChange={(checked) => handleReadWriteChange(project.id, !!checked)}
                                      />}
                                  </TableCell>
                                  {permission?.setPermissionsPerApp ?
                                    <TableHead>Read</TableHead>
                                    : <TableCell>
                                      <Checkbox
                                        id={`create-${project.id}`}
                                        checked={permission?.createWorkloads || false}
                                        onCheckedChange={(checked) => handleCreateChange(project.id, !!checked)}
                                      />
                                    </TableCell>}
                                  {permission?.setPermissionsPerApp ?
                                    <TableHead>Read, Write & Deploy</TableHead>
                                    : <TableCell>
                                      <Checkbox
                                        id={`delete-${project.id}`}
                                        checked={permission?.deleteWorkloads || false}
                                        onCheckedChange={(checked) => handleDeleteChange(project.id, !!checked)}
                                      />
                                    </TableCell>}
                                </TableRow>


                                {(permission?.workloadPermissions.length ?? 0) > 0 &&
                                  <>
                                    {permission?.workloadPermissions.map((roleAppPermission, index) =>

                                      <TableRow key={roleAppPermission.workloadId} className={permission.workloadPermissions.length - 1 === index ? 'border-b-gray-400' : ''}>
                                        <TableCell></TableCell>
                                        <TableCell></TableCell>
                                        <TableCell colSpan={2}>{roleAppPermission.workloadName}</TableCell>
                                        <TableCell>
                                          <Checkbox
                                            id={`app-read-${roleAppPermission.workloadId}`}
                                            checked={roleAppPermission.permission === RolePermissionEnum.READ}
                                            onCheckedChange={(checked) => handleAppReadChange(roleAppPermission.workloadId, !!checked)}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Checkbox
                                            id={`app-readwrite-${roleAppPermission.workloadId}`}
                                            checked={roleAppPermission.permission === RolePermissionEnum.READWRITE}
                                            onCheckedChange={(checked) => handleAppReadWriteChange(roleAppPermission.workloadId, !!checked)}
                                          />
                                        </TableCell>
                                      </TableRow>

                                    )}
                                  </>}
                              </>
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
