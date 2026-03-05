"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ImagePlus, Loader2, Plus, Trash2, Code2, Eye, EyeOff, X } from "lucide-react";
import { QuestionText } from "@/components/ui/question-text";

interface Option {
  id: string;
  text: string;
}

interface TestCaseInput {
  id: string;
  input: string;
  expectedOutput: string;
  isSample: boolean;
}

let optionCounter = 0;
function generateOptionId() {
  optionCounter += 1;
  return `opt_${Date.now()}_${optionCounter}`;
}

let testCaseCounter = 0;
function generateTestCaseId() {
  testCaseCounter += 1;
  return `tc_${Date.now()}_${testCaseCounter}`;
}

export default function NewQuestionPage() {
  const params = useParams<{ driveId: string; testId: string }>();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [questionText, setQuestionText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState("SINGLE_SELECT");
  const [options, setOptions] = useState<Option[]>([
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
    { id: generateOptionId(), text: "" },
  ]);
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>([]);
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [explanation, setExplanation] = useState("");

  // Coding question state
  const [testCases, setTestCases] = useState<TestCaseInput[]>([
    { id: generateTestCaseId(), input: "", expectedOutput: "", isSample: true },
  ]);

  const isCoding = questionType === "CODING";

  function addOption() {
    setOptions((prev) => [...prev, { id: generateOptionId(), text: "" }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) {
      toast.error("At least 2 options are required");
      return;
    }
    setOptions((prev) => prev.filter((o) => o.id !== id));
    setCorrectOptionIds((prev) => prev.filter((cid) => cid !== id));
  }

  function updateOptionText(id: string, text: string) {
    setOptions((prev) =>
      prev.map((o) => (o.id === id ? { ...o, text } : o))
    );
  }

  function handleSingleSelectChange(optionId: string) {
    setCorrectOptionIds([optionId]);
  }

  function handleMultiSelectChange(optionId: string, checked: boolean) {
    if (checked) {
      setCorrectOptionIds((prev) => [...prev, optionId]);
    } else {
      setCorrectOptionIds((prev) => prev.filter((id) => id !== optionId));
    }
  }

  function handleQuestionTypeChange(value: string) {
    setQuestionType(value);
    setCorrectOptionIds([]);
  }

  // Test case management
  function addTestCase() {
    setTestCases((prev) => [
      ...prev,
      { id: generateTestCaseId(), input: "", expectedOutput: "", isSample: false },
    ]);
  }

  function removeTestCase(id: string) {
    if (testCases.length <= 1) {
      toast.error("At least 1 test case is required");
      return;
    }
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  }

  function updateTestCase(id: string, field: keyof TestCaseInput, value: string | boolean) {
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (isCoding) {
      // Validate test cases
      const validTestCases = testCases.filter((tc) => tc.expectedOutput.trim());
      if (validTestCases.length === 0) {
        toast.error("At least 1 test case with expected output is required");
        return;
      }

      setIsSubmitting(true);

      const data = {
        questionText,
        imageUrl: imageUrl || undefined,
        questionType: "CODING",
        testCases: validTestCases.map((tc, idx) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
          order: idx,
        })),
        marks,
        negativeMarks,
        explanation: explanation || undefined,
      };

      try {
        const res = await fetch(`/api/tests/${params.testId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to add question");
        }

        toast.success("Coding question added successfully");
        router.push(
          `/college/drives/${params.driveId}/tests/${params.testId}`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // MCQ flow
      const filledOptions = options.filter((o) => o.text.trim());
      if (filledOptions.length < 2) {
        toast.error("At least 2 options with text are required");
        return;
      }

      if (correctOptionIds.length === 0) {
        toast.error("Please select at least one correct option");
        return;
      }

      setIsSubmitting(true);

      const data = {
        questionText,
        imageUrl: imageUrl || undefined,
        questionType,
        options: filledOptions,
        correctOptionIds,
        marks,
        negativeMarks,
        explanation: explanation || undefined,
      };

      try {
        const res = await fetch(`/api/tests/${params.testId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to add question");
        }

        toast.success("Question added successfully");
        router.push(
          `/college/drives/${params.driveId}/tests/${params.testId}`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong"
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link
            href={`/college/drives/${params.driveId}/tests/${params.testId}`}
          >
            <ArrowLeft />
            Back to Test
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Add Question</h1>
        <p className="text-muted-foreground">
          Create a new question for this test.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Question Details</CardTitle>
          <CardDescription>
            {isCoding
              ? "Set up the coding challenge with test cases."
              : "Fill in the question, options, and mark the correct answer(s)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="questionText">
                Question Text <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-1 mb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => {
                    const ta = textareaRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const selected = questionText.slice(start, end);
                    const codeBlock = selected
                      ? "```\n" + selected + "\n```"
                      : "```\n// paste code here\n```";
                    const newText =
                      questionText.slice(0, start) +
                      codeBlock +
                      questionText.slice(end);
                    setQuestionText(newText);
                    setShowPreview(false);
                    setTimeout(() => {
                      ta.focus();
                      const cursor = start + codeBlock.length;
                      ta.setSelectionRange(cursor, cursor);
                    }, 0);
                  }}
                >
                  <Code2 className="size-3.5" />
                  Code Block
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  {showPreview ? "Edit" : "Preview"}
                </Button>
              </div>
              {showPreview ? (
                <div className="min-h-[120px] rounded-md border bg-background p-3">
                  {questionText.trim() ? (
                    <QuestionText>{questionText}</QuestionText>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nothing to preview</p>
                  )}
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  id="questionText"
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={
                    isCoding
                      ? "Describe the coding problem... (supports Markdown — use ``` for code blocks)"
                      : "Enter your question here... (supports Markdown — use ``` for code blocks)"
                  }
                  rows={4}
                  className="font-mono text-sm"
                  required
                />
              )}
              <p className="text-xs text-muted-foreground">
                Supports Markdown. Wrap code in <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">```</code> fences for proper formatting.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Image <span className="text-muted-foreground font-normal">(optional)</span></Label>
              {imageUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Question image"
                    className="max-h-48 rounded-md border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5 shadow"
                    aria-label="Remove image"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-2 w-fit rounded-md border px-4 h-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                  <ImagePlus className="size-4" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setImageUrl(ev.target?.result as string);
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="questionType">Question Type</Label>
              <Select
                value={questionType}
                onValueChange={handleQuestionTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_SELECT">
                    Single Select (Radio)
                  </SelectItem>
                  <SelectItem value="MULTI_SELECT">
                    Multi Select (Checkbox)
                  </SelectItem>
                  <SelectItem value="CODING">
                    Coding Challenge
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* MCQ Options */}
            {!isCoding && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    Options <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOption}
                  >
                    <Plus className="size-4" />
                    Add Option
                  </Button>
                </div>

                {questionType === "SINGLE_SELECT" ? (
                  <RadioGroup
                    value={correctOptionIds[0] || ""}
                    onValueChange={handleSingleSelectChange}
                    className="space-y-3"
                  >
                    {options.map((option, index) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-3"
                      >
                        <RadioGroupItem
                          value={option.id}
                          id={`radio-${option.id}`}
                        />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) =>
                            updateOptionText(option.id, e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div
                        key={option.id}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`check-${option.id}`}
                          checked={correctOptionIds.includes(option.id)}
                          onCheckedChange={(checked) =>
                            handleMultiSelectChange(
                              option.id,
                              checked as boolean
                            )
                          }
                        />
                        <Input
                          className="flex-1"
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) =>
                            updateOptionText(option.id, e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(option.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {questionType === "SINGLE_SELECT"
                    ? "Select the radio button next to the correct answer."
                    : "Check the boxes next to all correct answers."}
                </p>
              </div>
            )}

            {/* Test Cases for Coding */}
            {isCoding && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    Test Cases <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTestCase}
                  >
                    <Plus className="size-4" />
                    Add Test Case
                  </Button>
                </div>

                {testCases.map((tc, index) => (
                  <Card key={tc.id} className="border-dashed">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Test Case {index + 1}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`sample-${tc.id}`}
                              checked={tc.isSample}
                              onCheckedChange={(checked) =>
                                updateTestCase(tc.id, "isSample", checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`sample-${tc.id}`}
                              className="text-xs text-muted-foreground"
                            >
                              Sample (visible to students)
                            </Label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTestCase(tc.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Input</Label>
                        <Textarea
                          value={tc.input}
                          onChange={(e) =>
                            updateTestCase(tc.id, "input", e.target.value)
                          }
                          placeholder="Enter input (can be empty)"
                          rows={2}
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">
                          Expected Output{" "}
                          <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          value={tc.expectedOutput}
                          onChange={(e) =>
                            updateTestCase(
                              tc.id,
                              "expectedOutput",
                              e.target.value
                            )
                          }
                          placeholder="Enter expected output"
                          rows={2}
                          className="font-mono text-sm"
                          required
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <p className="text-xs text-muted-foreground">
                  Mark test cases as &ldquo;Sample&rdquo; to make them visible
                  to students. Hidden test cases are used only for grading.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="marks">Marks</Label>
                <Input
                  id="marks"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={(e) => setMarks(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="negativeMarks">Negative Marks</Label>
                <Input
                  id="negativeMarks"
                  type="number"
                  min={0}
                  step="0.25"
                  value={negativeMarks}
                  onChange={(e) =>
                    setNegativeMarks(parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="explanation">Explanation (optional)</Label>
              <Textarea
                id="explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explain the correct answer (shown after submission)"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Add Question
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link
                  href={`/college/drives/${params.driveId}/tests/${params.testId}`}
                >
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
