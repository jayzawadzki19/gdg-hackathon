import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

// Returns a plain HTML string meant for [innerHTML] binding: Angular's
// built-in sanitizer then strips scripts and event handlers, so agent
// output never needs bypassSecurityTrust.
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) {
      return '';
    }
    // breaks: single newlines become <br>, matching chat-style replies.
    return marked.parse(value, { async: false, gfm: true, breaks: true });
  }
}
