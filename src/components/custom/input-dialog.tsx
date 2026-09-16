'use client'

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import React, { useEffect } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useInputDialog } from "@/frontend/states/zustand.states";

export function InputDialog() {
  const { isDialogOpen, data, closeDialog } = useInputDialog();
  const [inputValue, setInputValue] = React.useState<string>(data?.inputValue ?? '');

  useEffect(() => {
    setInputValue(data?.inputValue ?? '');
  }, [data]);

  if (!data) {
    return <></>;
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={() => closeDialog()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{data.title}</DialogTitle>
          {data.description && <DialogDescription>
            {data.description}
          </DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            {data.fieldName && <Label className="text-right">
              {data.fieldName}
            </Label>}
            <Input
              value={inputValue}
              onKeyUp={(key) => {
                if (key.key === 'Enter' && inputValue) {
                  closeDialog(inputValue);
                }
              }}
              onChange={(e) => setInputValue(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            if (!inputValue) return;
            closeDialog(inputValue)
          }}>{data.okButton ?? 'OK'}</Button>
          <Button variant="secondary" onClick={() => closeDialog(undefined)}>{data.cancelButton ?? 'Cancel'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/*

export function InputDialog({
  children,
  title,
  description,
  fieldName,
  OKButton = 'OK',
  CancelButton = 'Cancel',
  onResult
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  fieldName: string;
  OKButton?: string;
  CancelButton?: string;
}) {

  const [value, setValue] = React.useState<string>("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessages, setErrorMessages] = React.useState<string>("");

  const { isDialogOpen, data, closeDialog } = useInputDialog();
  const [inputValue, setInputValue] = React.useState<string>(data?.inputValue ?? '');

  useEffect(() => {
    setInputValue(data?.inputValue ?? '');
  }, [data]);

  if (!data) {
    return <></>;
  }

  const submit = async () => {
    try {
      if (!value) {
        return;
      }
      setIsLoading(true);
      setErrorMessages("");
      const result = await onResult(value);
      if (result === true) {
        setIsOpen(false);
        setValue("");
      } else {
        setErrorMessages(result || "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(isO) => setIsOpen(isO)}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor={fieldName} className="text-right">
              {fieldName}
            </Label>
            <Input disabled={isLoading} id={fieldName}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyUp={(e) => {
                if (e.key === "Enter") {
                  submit();
                }
              }}
              className="col-span-3"
            />
          </div>
        </div>
        <p className="text-sm text-right text-red-500">{errorMessages}</p>
        <DialogFooter>
          <Button disabled={isLoading} onClick={submit}>{isLoading ? <LoadingSpinner /> : OKButton}</Button>
          <Button disabled={isLoading} variant="secondary" onClick={() => {
            onResult(undefined);
            setValue("");
            setIsOpen(false);
          }}>{CancelButton}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
*/