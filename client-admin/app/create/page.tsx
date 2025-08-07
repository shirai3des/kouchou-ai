"use client";

import { Header } from "@/components/Header";
import { toaster } from "@/components/ui/toaster";
import { Box, Button, Field, HStack, Heading, Presence, Tabs, Text, VStack, useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createReport } from "./api/createReport";
import { AISettingsSection } from "./components/AISettingsSection";
import { BasicInfoSection } from "./components/BasicInfoSection";
import { CsvFileTab } from "./components/CsvFileTab";
import { EnvironmentCheckDialog } from "./components/EnvironmentCheckDialog/EnvironmentCheckDialog";
import { SpreadsheetTab } from "./components/SpreadsheetTab";
import { WarningSection } from "./components/WarningSection";
import { useAISettings } from "./hooks/useAISettings";
import { useBasicInfo } from "./hooks/useBasicInfo";
import { useClusterSettings } from "./hooks/useClusterSettings";
import { useInputData } from "./hooks/useInputData";
import { usePromptSettings } from "./hooks/usePromptSettings";
import { type CsvData, parseCsv } from "./parseCsv";
import { validateFormValues } from "./utils/validation";

/**
 * レポート作成ページ
 */
export default function Page() {
  const router = useRouter();
  const { open, onToggle } = useDisclosure();
  const [loading, setLoading] = useState<boolean>(false);

  // カスタムフックの使用
  const basicInfo = useBasicInfo();
  const clusterSettings = useClusterSettings();
  const promptSettings = usePromptSettings();
  const aiSettings = useAISettings();
  const inputData = useInputData(clusterSettings.setRecommended);

  /**
   * タブ切り替え時の処理
   */
  const handleTabValueChange = (details: { value: string }) => {
    inputData.setInputType(details.value as "file" | "spreadsheet");
  };

  /**
   * レポート作成の送信
   */
  const onSubmit = async () => {
    setLoading(true);

    // フォーム入力値のバリデーション
    const validation = validateFormValues({
      input: basicInfo.input,
      question: basicInfo.question,
      intro: basicInfo.intro,
      clusterLv1: clusterSettings.clusterLv1,
      clusterLv2: clusterSettings.clusterLv2,
      model: aiSettings.model,
      extractionPrompt: promptSettings.extraction,
      inputType: inputData.inputType,
      csv: inputData.csv,
      spreadsheetImported: inputData.spreadsheetImported,
      selectedCommentColumn: inputData.selectedCommentColumn,
      csvColumns: inputData.csvColumns,
      selectedAttributeColumns: inputData.selectedAttributeColumns,
      provider: aiSettings.provider,
      modelOptions: aiSettings.getCurrentModels(),
    });

    if (!validation.isValid) {
      toaster.create({
        type: "error",
        title: "入力エラー",
        description: validation.errorMessage,
      });
      setLoading(false);
      return;
    }

    let comments: CsvData[] = [];
    try {
      if (inputData.inputType === "file" && inputData.csv) {
        const parsed = await parseCsv(inputData.csv);
        comments = parsed.map((row, index) => {
          const rowData = row as unknown as Record<string, unknown>;

          // コメントオブジェクトの作成（基本フィールド）
          const comment: CsvData = {
            id: row.id || `csv-${index + 1}`,
            comment: rowData[inputData.selectedCommentColumn] as string,
            source: (rowData.source as string) || null,
            url: (rowData.url as string) || null,
          };

          // 選択された属性カラムの値を直接追加（"attribute" プレフィックス付き）
          for (const attrCol of inputData.selectedAttributeColumns) {
            if (rowData[attrCol] !== undefined && rowData[attrCol] !== null) {
              // 属性カラムの名前に "attribute" プレフィックスを追加
              const attributeKey = `attribute_${attrCol}`;
              comment[attributeKey] = rowData[attrCol] as string;
            }
          }

          return comment;
        });

        if (comments.length < clusterSettings.clusterLv2) {
          const confirmProceed = window.confirm(
            `csvファイルの行数 (${comments.length}) が設定された意見グループ数 (${clusterSettings.clusterLv2}) を下回っています。このまま続けますか？
    \n※コメントから抽出される意見が設定された意見グループ数に満たない場合、処理中にエラーになる可能性があります（一つのコメントから複数の意見が抽出されることもあるため、問題ない場合もあります）。
    \n意見グループ数を変更する場合は、「AI詳細設定」を開いてください。`,
          );
          if (!confirmProceed) {
            setLoading(false);
            return;
          }
        }
      } else if (inputData.inputType === "spreadsheet" && inputData.spreadsheetImported) {
        comments = inputData.spreadsheetData.map((row, index) => {
          const rowData = row as unknown as Record<string, unknown>;

          // コメントオブジェクトの作成（基本フィールド）
          const comment: CsvData = {
            id: row.id || `spreadsheet-${index + 1}`,
            comment: rowData[inputData.selectedCommentColumn] as string,
            source: row.source || null,
            url: row.url || null,
          };

          // 選択された属性カラムの値を直接追加（"attribute" プレフィックス付き）
          for (const attrCol of inputData.selectedAttributeColumns) {
            if (rowData[attrCol] !== undefined && rowData[attrCol] !== null) {
              // 属性カラムの名前に "attribute" プレフィックスを追加
              const attributeKey = `attribute_${attrCol}`;
              comment[attributeKey] = rowData[attrCol] as string;
            }
          }

          return comment;
        });
      }
    } catch (e) {
      toaster.create({
        type: "error",
        title: "データの読み込みに失敗しました",
        description: e as string,
      });
      setLoading(false);
      return;
    }

    const promptData = promptSettings.getPromptSettings();

    const result = await createReport({
      input: basicInfo.input,
      question: basicInfo.question,
      intro: basicInfo.intro,
      comments,
      cluster: [clusterSettings.clusterLv1, clusterSettings.clusterLv2],
      provider: aiSettings.provider,
      model: aiSettings.model,
      workers: aiSettings.workers,
      prompt: promptData,
      is_pubcom: aiSettings.isPubcomMode,
      inputType: inputData.inputType,
      is_embedded_at_local: aiSettings.isEmbeddedAtLocal,
      enable_source_link: aiSettings.enableSourceLink,
      local_llm_address: aiSettings.provider === "local" ? aiSettings.localLLMAddress : undefined,
    });

    if (result.success) {
      toaster.create({
        duration: 5000,
        type: "success",
        title: "レポート作成を開始しました",
      });

      router.replace("/");
    } else {
      toaster.create({
        type: "error",
        title: "レポート作成に失敗しました",
        description: result.error,
      });
    }

    setLoading(false);
  };

  // メインコンポーネントのレンダリング
  return (
    <div className={"container"}>
      <Header />
      <Box mx={"auto"} maxW={"800px"} px="6" py="12">
        <Heading textAlign={"center"} my={10}>
          新しいレポートを作成する
        </Heading>
        <VStack gap={5}>
          {/* 基本情報セクション */}
          <BasicInfoSection
            input={basicInfo.input}
            question={basicInfo.question}
            intro={basicInfo.intro}
            isIdValid={basicInfo.isIdValid}
            onIdChange={basicInfo.handleIdChange}
            onQuestionChange={basicInfo.handleQuestionChange}
            onIntroChange={basicInfo.handleIntroChange}
          />

          {/* 入力データセクション */}
          <Field.Root>
            <Field.Label>入力データ</Field.Label>
            <Tabs.Root
              defaultValue="file"
              value={inputData.inputType}
              onValueChange={handleTabValueChange}
              variant="enclosed"
              width="100%"
            >
              <Tabs.List>
                <Tabs.Trigger value="file">CSVファイル</Tabs.Trigger>
                <Tabs.Trigger value="spreadsheet">Googleスプレッドシート</Tabs.Trigger>
                <Tabs.Indicator />
              </Tabs.List>

              <Box p={4}>
                {/* CSVファイルタブ */}
                <CsvFileTab
                  csv={inputData.csv}
                  setCsv={inputData.setCsv}
                  csvColumns={inputData.csvColumns}
                  setCsvColumns={inputData.setCsvColumns}
                  selectedCommentColumn={inputData.selectedCommentColumn}
                  setSelectedCommentColumn={inputData.setSelectedCommentColumn}
                  selectedAttributeColumns={inputData.selectedAttributeColumns}
                  setSelectedAttributeColumns={inputData.setSelectedAttributeColumns}
                  clusterSettings={clusterSettings}
                />

                {/* スプレッドシートタブ */}
                <SpreadsheetTab
                  spreadsheetUrl={inputData.spreadsheetUrl}
                  setSpreadsheetUrl={inputData.setSpreadsheetUrl}
                  spreadsheetImported={inputData.spreadsheetImported}
                  spreadsheetLoading={inputData.spreadsheetLoading}
                  spreadsheetData={inputData.spreadsheetData}
                  importedId={inputData.importedId}
                  canImport={inputData.canImport}
                  csvColumns={inputData.csvColumns}
                  selectedCommentColumn={inputData.selectedCommentColumn}
                  setSelectedCommentColumn={inputData.setSelectedCommentColumn}
                  selectedAttributeColumns={inputData.selectedAttributeColumns}
                  setSelectedAttributeColumns={inputData.setSelectedAttributeColumns}
                  clusterSettings={clusterSettings}
                  onImport={() => inputData.importSpreadsheet(basicInfo.input)}
                  onClearData={inputData.clearSpreadsheetData}
                />
              </Box>
            </Tabs.Root>
          </Field.Root>

          <HStack justify={"flex-end"} w={"full"}>
            <Button onClick={onToggle} variant={"outline"}>
              レポート生成設定
            </Button>
          </HStack>

          {/* AI詳細設定セクション */}
          <Presence present={open} w={"full"}>
            <AISettingsSection
              provider={aiSettings.provider}
              model={aiSettings.model}
              workers={aiSettings.workers}
              isPubcomMode={aiSettings.isPubcomMode}
              enableSourceLink={aiSettings.enableSourceLink}
              isEmbeddedAtLocal={aiSettings.isEmbeddedAtLocal}
              localLLMAddress={aiSettings.localLLMAddress}
              onProviderChange={aiSettings.handleProviderChange}
              onModelChange={aiSettings.handleModelChange}
              fetchLocalLLMModels={aiSettings.fetchLocalLLMModels}
              onWorkersChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) {
                  aiSettings.handleWorkersChange(v);
                }
              }}
              onIncreaseWorkers={aiSettings.increaseWorkers}
              onDecreaseWorkers={aiSettings.decreaseWorkers}
              onPubcomModeChange={aiSettings.handlePubcomModeChange}
              onEnableSourceLinkChange={aiSettings.handleEnableSourceLinkChange}
              onEmbeddedAtLocalChange={(checked) => {
                if (checked === "indeterminate") return;
                aiSettings.setIsEmbeddedAtLocal(checked);
              }}
              setLocalLLMAddress={aiSettings.setLocalLLMAddress}
              getModelDescription={aiSettings.getModelDescription}
              getProviderDescription={aiSettings.getProviderDescription}
              getCurrentModels={aiSettings.getCurrentModels}
              requiresConnectionSettings={aiSettings.requiresConnectionSettings}
              isEmbeddedAtLocalDisabled={aiSettings.isEmbeddedAtLocalDisabled}
              promptSettings={promptSettings}
            />
          </Presence>

          {/* 警告メッセージ */}
          <WarningSection />

          <VStack mt="11" gap="6">
            <EnvironmentCheckDialog provider={aiSettings.provider} />
            {/* 送信ボタン */}
            <Button className={"gradientBg shadow"} size={"2xl"} w={"300px"} onClick={onSubmit} loading={loading}>
              レポート作成を開始
            </Button>
            <Text textStyle="body/sm" color="font.secondary">
              有料のAIプロバイダーの場合は作成する度にAPI利用料がかかります。
            </Text>
          </VStack>
        </VStack>
      </Box>
    </div>
  );
}
