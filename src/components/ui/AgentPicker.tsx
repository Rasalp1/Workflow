import { useId } from "react";
import { Check, Cpu, Eye, Terminal } from "lucide-react";
import type { AgentType } from "@/types";

export function AgentPicker({
  value,
  onChange,
  disabled = false,
  label = "Choose an agent",
  name,
  agents,
}: {
  value: AgentType;
  onChange: (value: AgentType) => void;
  disabled?: boolean;
  label?: string;
  name?: string;
  agents?: readonly AgentType[];
}) {
  const generatedId = useId();
  const groupName = name || `${generatedId}-${label.replace(/\s+/g, "-")}`;
  const availableAgents: readonly AgentType[] =
    agents ||
    (value === "ocr" ? (["ocr"] as const) : (["codex", "claude"] as const));

  return (
    <fieldset className="field-group" disabled={disabled}>
      <legend className="field-label">{label}</legend>
      <div className="agent-picker" role="radiogroup" aria-label={label}>
        {availableAgents.map((agent) => {
          const inputId = `${groupName}-${agent}`;
          const isSelected = value === agent;
          return (
            <label
              htmlFor={inputId}
              className="agent-option"
              data-agent={agent}
              data-selected={isSelected}
              key={agent}
              onClick={() => {
                if (!disabled && onChange) {
                  onChange(agent);
                }
              }}
            >
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={agent}
                checked={isSelected}
                onChange={() => onChange(agent)}
                disabled={disabled}
              />
              <span className="agent-option-icon">
                {agent === "codex" ? (
                  <Terminal size={20} />
                ) : agent === "claude" ? (
                  <Cpu size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </span>
              <span>
                <strong>
                  {agent === "codex"
                    ? "Codex"
                    : agent === "claude"
                      ? "Claude Code"
                      : "OpenCodeReview"}
                </strong>
                <small>
                  {agent === "codex"
                    ? "OpenAI"
                    : agent === "claude"
                      ? "Anthropic"
                      : "Alibaba OCR (Luna)"}
                </small>
              </span>
              {isSelected && (
                <Check size={16} className="agent-option-check" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
