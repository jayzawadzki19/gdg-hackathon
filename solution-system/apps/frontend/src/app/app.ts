import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ChatPage } from './chat/chat-page';

@Component({
  imports: [ChatPage, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
