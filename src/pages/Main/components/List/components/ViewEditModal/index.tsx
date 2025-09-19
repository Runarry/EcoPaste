import { MainContext } from "@/pages/Main";
import { writeText } from "@/plugins/clipboard";
import type { HistoryTablePayload } from "@/types/database";
import { Form, Input, Modal, Typography, message } from "antd";
import type { TextAreaRef } from "antd/es/input/TextArea";
import { t } from "i18next";
import { find } from "lodash-es";
import type { KeyboardEvent } from "react";

export interface ViewEditModalRef {
	open: () => void;
}

interface FormFields {
	content: string;
}

const editableTypes = new Set<HistoryTablePayload["type"]>([
	"text",
	"html",
	"rtf",
]);
const MAX_CONTENT_LENGTH = 100000;

const getEditableText = (item?: HistoryTablePayload) => {
	if (!item) return "";

	const { type, value, search } = item;

	if (type === "text") {
		return value;
	}

	if (type === "html" || type === "rtf") {
		return search;
	}

	return "";
};

const modalStyles = {
	body: {
		overflow: "hidden" as const,
		paddingBottom: 0,
	},
};

const ViewEditModal = forwardRef<ViewEditModalRef>((_, ref) => {
	const { state } = useContext(MainContext);
	const [open, { setTrue, setFalse }] = useBoolean(false);
	const [form] = Form.useForm<FormFields>();
	const textAreaRef = useRef<TextAreaRef>(null);
	const [submitting, setSubmitting] = useState(false);
	const [currentType, setCurrentType] = useState<HistoryTablePayload["type"]>();

	const pinStateRef = useRef({
		previous: false,
		changed: false,
	});

	const restorePin = () => {
		if (!pinStateRef.current.changed) return;

		state.pin = pinStateRef.current.previous;
		pinStateRef.current.changed = false;
	};

	useUnmount(restorePin);

	const closeModal = () => {
		setFalse();
	};

	useImperativeHandle(ref, () => ({
		open: () => {
			const target = find(state.list, { id: state.activeId });

			if (!target || !editableTypes.has(target.type)) {
				message.warning(t("clipboard.view_modal.unsupported"));
				return;
			}

			const alreadyPinned = Boolean(state.pin);
			pinStateRef.current.previous = state.pin ?? false;
			pinStateRef.current.changed = !alreadyPinned;

			if (!alreadyPinned) {
				state.pin = true;
			}

			const content = getEditableText(target);

			form.setFieldsValue({ content });
			setSubmitting(false);
			setCurrentType(target.type);
			setTrue();
		},
	}));

	const handleAfterOpenChange = (visible: boolean) => {
		if (visible) {
			requestAnimationFrame(() => {
				textAreaRef.current?.focus({ cursor: "end" });
			});

			return;
		}

		restorePin();
		pinStateRef.current.previous = state.pin ?? false;

		setCurrentType(void 0);
		form.resetFields();
	};

	const handleCancel = () => {
		setSubmitting(false);
		closeModal();
	};

	const handleOk = async () => {
		const { content } = form.getFieldsValue();

		setSubmitting(true);

		try {
			await writeText(content ?? "");

			message.success(t("clipboard.view_modal.success"));
			closeModal();
		} finally {
			setSubmitting(false);
		}
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (!((event.ctrlKey || event.metaKey) && event.key === "Enter")) return;

		event.preventDefault();

		void handleOk();
	};

	const showPlainTextNotice = currentType === "html" || currentType === "rtf";

	return (
		<Modal
			forceRender
			centered
			width={600}
			title={t("clipboard.view_modal.title")}
			open={open}
			okText={t("clipboard.view_modal.confirm")}
			cancelText={t("clipboard.view_modal.cancel")}
			onOk={handleOk}
			onCancel={handleCancel}
			afterOpenChange={handleAfterOpenChange}
			confirmLoading={submitting}
			keyboard
			styles={modalStyles}
		>
			{showPlainTextNotice ? (
				<Typography.Paragraph type="secondary" className="mb-3">
					{t("clipboard.view_modal.notice")}
				</Typography.Paragraph>
			) : null}

			<Form form={form} onFinish={handleOk}>
				<Form.Item name="content" style={{ marginBottom: 32 }}>
					<Input.TextArea
						ref={textAreaRef}
						rows={14}
						maxLength={MAX_CONTENT_LENGTH}
						showCount
						placeholder={t("clipboard.view_modal.placeholder")}
						onKeyDown={handleKeyDown}
						styles={{
							textarea: {
								minHeight: 360,
								maxHeight: 480,
								overflow: "auto",
							},
							count: {
								marginTop: 8,
							},
						}}
					/>
				</Form.Item>
			</Form>
		</Modal>
	);
});

export default ViewEditModal;
