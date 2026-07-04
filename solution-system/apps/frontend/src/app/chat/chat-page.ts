import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';
import { ChatService } from './chat.service';

@Component({
  selector: 'app-chat-page',
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPage {
  protected readonly chat = inject(ChatService);

  private readonly logRef = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly inputRef =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  constructor() {
    // Keep the log scrolled to the newest message. Runs after render, so the
    // new bubble is already in the DOM; instant jump (no smooth behavior), so
    // reduced-motion needs no special casing here.
    afterRenderEffect(() => {
      this.chat.messages();
      this.chat.pending();
      const log = this.logRef().nativeElement;
      log.scrollTo({ top: log.scrollHeight });
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.sendCurrent();
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Enter sends; Shift+Enter falls through to insert a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendCurrent();
    }
  }

  protected onInput(): void {
    this.resizeInput();
  }

  private sendCurrent(): void {
    const textarea = this.inputRef().nativeElement;
    if (!textarea.value.trim() || this.chat.pending()) {
      return;
    }
    void this.chat.send(textarea.value);
    textarea.value = '';
    this.resizeInput();
    textarea.focus();
  }

  // Auto-grow: collapse, then track content height (capped in CSS).
  private resizeInput(): void {
    const textarea = this.inputRef().nativeElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
