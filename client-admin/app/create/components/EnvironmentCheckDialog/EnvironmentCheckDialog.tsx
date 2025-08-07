"use client";

import { Button } from "@/components/ui/button";
import {
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Box, DialogActionTrigger, DialogFooter, Image, Text } from "@chakra-ui/react";
import { SquareArrowOutUpRight } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { ErrorIcon } from "./ErrorIcon";
import { GradientCheckIcon } from "./GradientCheckIcon";
import { verifyApiKey } from "./verifyApiKey";

function Dialog({ provider }: { provider: string }) {
  const [state, action, isPending] = useActionState(verifyApiKey, { result: null, error: false });

  return (
    <>
      {!state.result && !state.error ? (
        // 初期状態のダイアログ
        <DialogContent
          color="font.primary"
          bg="linear-gradient(216.39deg, #FCFFDB -0.01%, #F0FDF4 24.99%, #ECFEFF 35%, #FFFFFF 50%);"
        >
          <DialogHeader justifyContent="center" pb="0">
            <DialogTitle textStyle="body/lg/bold">API接続チェック</DialogTitle>
          </DialogHeader>
          <DialogBody
            pt="3"
            px="8"
            pb="8"
            display="flex"
            flexDirection="column"
            justifyContent="center"
            textAlign="center"
          >
            <Text textStyle="body/md">APIキー設定とデポジット残高を確認します。</Text>
            <Image src="/images/check-api-img.svg" alt="" mt="6" />
            <Text textStyle="body/sm" textAlign="left" mt="6">
              接続チェックにはAPIを使用します。有料のAIプロバイダーの場合は1回あたり約0.005円のAPI利用料がかかります。
            </Text>
            <Text textStyle="body/sm" color="font.secondary" mt="4">
              ボタン押下をもって上記に同意とみなします。
            </Text>
            <Box mt="4">
              <Button size="md" onClick={() => startTransition(() => action(provider))} loading={isPending}>
                チェックする
              </Button>
            </Box>
          </DialogBody>
          <DialogCloseTrigger />
        </DialogContent>
      ) : !state.error ? (
        // チェック結果が成功の場合のダイアログ
        <DialogContent color="font.primary">
          <DialogHeader justifyContent="center" pb="0">
            <DialogTitle textStyle="body/lg/bold">
              <GradientCheckIcon />
            </DialogTitle>
          </DialogHeader>
          <DialogBody
            pt="3"
            px="8"
            pb="4"
            display="flex"
            flexDirection="column"
            justifyContent="center"
            textAlign="center"
          >
            <Text textStyle="body/md">{state.result?.message}</Text>
          </DialogBody>
          <DialogCloseTrigger />
          <DialogFooter justifyContent="center">
            <DialogActionTrigger asChild>
              <Button variant="tertiary" size="md">
                閉じる
              </Button>
            </DialogActionTrigger>
          </DialogFooter>
        </DialogContent>
      ) : (
        // チェック結果がエラーの場合のダイアログ
        <DialogContent color="font.primary">
          <DialogHeader justifyContent="center" pb="0">
            <DialogTitle textStyle="body/lg/bold">
              <ErrorIcon />
            </DialogTitle>
          </DialogHeader>
          <DialogBody
            pt="3"
            px="8"
            pb="4"
            display="flex"
            flexDirection="column"
            justifyContent="center"
            textAlign="center"
          >
            <Text textStyle="body/md">
              エラーが見つかりました。
              <br />
              内容をご確認ください。
            </Text>
            <Box p="4" mt="6" bg="rgba(254, 242, 242, 1)" color="font.error" textAlign="left" textStyle="body/sm">
              {state.result?.message}
            </Box>
          </DialogBody>
          <DialogCloseTrigger />
          <DialogFooter justifyContent="center">
            <DialogActionTrigger asChild>
              <Button variant="tertiary" size="md">
                閉じる
              </Button>
            </DialogActionTrigger>
          </DialogFooter>
        </DialogContent>
      )}
    </>
  );
}

export function EnvironmentCheckDialog({ provider }: { provider: string }) {
  const [uuid, setUUID] = useState(crypto.randomUUID());

  return (
    <DialogRoot
      key={uuid}
      size="sm"
      placement="center"
      onOpenChange={(e) => {
        if (!e.open) {
          // Dialogが閉じられたときにkeyを更新して再レンダリングをトリガー
          setUUID(crypto.randomUUID());
        }
      }}
    >
      <DialogBackdrop
        zIndex={1000}
        position="fixed"
        inset={0}
        backgroundColor="blackAlpha.100"
        backdropFilter="blur(2px)"
      />
      <DialogTrigger asChild>
        <Button variant="ghost">
          API接続チェック <SquareArrowOutUpRight />
        </Button>
      </DialogTrigger>
      <Dialog provider={provider} />
    </DialogRoot>
  );
}
