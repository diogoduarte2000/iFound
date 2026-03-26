import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chats.component.html',
  styleUrls: ['./chats.component.scss']
})
export class ChatsComponent implements OnInit, OnDestroy {
  conversations: any[] = [];
  activeConversation: any = null;
  currentUserId = '';

  isConversationLoading = false;
  isChatLoading = false;
  isSendingMessage = false;
  conversationError = '';
  chatError = '';
  chatInfo = '';
  chatMessage = '';
  selectedChatFiles: File[] = [];
  selectedChatPreviews: { name: string; url: string }[] = [];

  private chatPollInterval: ReturnType<typeof setInterval> | null = null;
  private publicationIdFromRoute: string | null = null;
  private chatIdFromRoute: string | null = null;
  private ownerViewFromRoute = false;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserId = this.authService.getCurrentUser()?.id || '';
    this.loadConversations();

    this.route.queryParamMap.subscribe((params) => {
      this.publicationIdFromRoute = params.get('publicationId');
      this.chatIdFromRoute = params.get('chatId');
      this.ownerViewFromRoute = params.get('ownerView') === '1';
      this.handleRouteIntent();
    });
  }

  ngOnDestroy() {
    this.stopChatPolling();
    this.clearSelectedChatFiles();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadConversations() {
    this.isConversationLoading = true;
    this.conversationError = '';

    this.chatService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        this.isConversationLoading = false;

        if (!this.activeConversation && !this.isChatLoading) {
          this.handleRouteIntent();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isConversationLoading = false;
        this.conversationError = err.error?.message || 'Nao foi possivel carregar as conversas.';
      }
    });
  }

  openConversationFromPublication(publicationId: string) {
    this.isChatLoading = true;
    this.chatError = '';
    this.chatInfo = 'A abrir conversa privada...';

    this.chatService.openConversation(publicationId).subscribe({
      next: (conversation) => {
        this.activeConversation = conversation;
        this.chatInfo = 'Apenas tu e a outra pessoa conseguem ver estas mensagens.';
        this.isChatLoading = false;
        this.syncConversationSummary(conversation);
        this.startChatPolling();
      },
      error: (err: HttpErrorResponse) => {
        this.isChatLoading = false;
        this.chatError = err.error?.message || 'Nao foi possivel abrir o chat.';
      }
    });
  }

  openExistingConversation(conversationId: string) {
    if (this.activeConversation?._id === conversationId && !this.isChatLoading) {
      return;
    }

    this.isChatLoading = true;
    this.chatError = '';
    this.chatInfo = '';

    this.chatService.getConversation(conversationId).subscribe({
      next: (conversation) => {
        this.activeConversation = conversation;
        this.chatInfo = 'Apenas tu e a outra pessoa conseguem ver estas mensagens.';
        this.isChatLoading = false;
        this.syncConversationSummary(conversation);
        this.startChatPolling();
      },
      error: (err: HttpErrorResponse) => {
        this.isChatLoading = false;
        this.chatError = err.error?.message || 'Nao foi possivel abrir esta conversa.';
      }
    });
  }

  onChatFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const nextFiles = Array.from(input.files || []);

    this.chatError = '';

    if (nextFiles.length > 3) {
      this.chatError = 'Pode selecionar no maximo 3 fotos.';
      input.value = '';
      return;
    }

    const invalidFile = nextFiles.find((file) => !file.type.startsWith('image/') || file.size > 4 * 1024 * 1024);
    if (invalidFile) {
      this.chatError = 'As fotos devem ser imagens e cada uma pode ter no maximo 4MB.';
      input.value = '';
      return;
    }

    this.clearSelectedChatFiles();
    this.selectedChatFiles = nextFiles;
    this.selectedChatPreviews = nextFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file)
    }));
    input.value = '';
  }

  removeSelectedPhoto(index: number) {
    const preview = this.selectedChatPreviews[index];
    if (preview) {
      URL.revokeObjectURL(preview.url);
    }

    this.selectedChatFiles.splice(index, 1);
    this.selectedChatPreviews.splice(index, 1);
  }

  async sendChatMessage() {
    if (!this.activeConversation?._id || this.isSendingMessage) {
      return;
    }

    const text = this.chatMessage.trim();
    if (!text && this.selectedChatFiles.length === 0) {
      return;
    }

    this.isSendingMessage = true;
    this.chatError = '';

    try {
      const attachments = await Promise.all(
        this.selectedChatFiles.map(async (file) => ({
          originalName: file.name,
          mimeType: file.type,
          dataUrl: await this.fileToDataUrl(file)
        }))
      );

      this.chatService.sendMessage(this.activeConversation._id, { text, attachments }).subscribe({
        next: (conversation) => {
          this.activeConversation = conversation;
          this.chatMessage = '';
          this.chatInfo = 'Mensagem enviada. Continua privada entre os dois participantes.';
          this.isSendingMessage = false;
          this.clearSelectedChatFiles();
          this.syncConversationSummary(conversation);
          this.loadConversations();
        },
        error: (err: HttpErrorResponse) => {
          this.isSendingMessage = false;
          this.chatError = err.error?.message || 'Nao foi possivel enviar a mensagem.';
        }
      });
    } catch {
      this.isSendingMessage = false;
      this.chatError = 'Nao foi possivel ler as imagens selecionadas.';
    }
  }

  getConversationPartner(conversation: any) {
    return conversation?.participants?.find((participant: any) => participant._id !== this.currentUserId)
      || conversation?.publication?.author;
  }

  getLastMessagePreview(conversation: any) {
    if (!conversation?.lastMessage) {
      return 'Sem mensagens ainda.';
    }

    if (conversation.lastMessage.text) {
      return conversation.lastMessage.text;
    }

    if (conversation.lastMessage.hasAttachments) {
      return 'Enviou fotos temporarias.';
    }

    return 'Sem mensagens ainda.';
  }

  getAttachmentUrl(attachment: any) {
    return this.chatService.resolveAttachmentUrl(attachment.url);
  }

  private handleRouteIntent() {
    if (this.publicationIdFromRoute) {
      const relatedConversations = this.conversations
        .filter((conversation) => conversation.publication?._id === this.publicationIdFromRoute)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

      if (relatedConversations.length > 0) {
        this.chatInfo = this.ownerViewFromRoute
          ? 'Abriste as conversas desta publicacao. Aqui podes combinar a devolucao e enviar fotos que expiram em 12 horas.'
          : this.chatInfo;
        this.openExistingConversation(relatedConversations[0]._id);
        this.publicationIdFromRoute = null;
        this.ownerViewFromRoute = false;
        return;
      }

      if (this.ownerViewFromRoute) {
        this.activeConversation = null;
        this.chatInfo = 'Ainda ninguem te contactou nesta comunicacao. Quando alguem usar Comunicar, a conversa aparecera aqui e poderao trocar mensagens e fotos durante 12 horas.';
        this.chatError = '';
        this.publicationIdFromRoute = null;
        this.ownerViewFromRoute = false;
        return;
      }

      this.openConversationFromPublication(this.publicationIdFromRoute);
      this.publicationIdFromRoute = null;
      return;
    }

    if (this.chatIdFromRoute) {
      this.openExistingConversation(this.chatIdFromRoute);
      this.chatIdFromRoute = null;
      return;
    }

    if (!this.activeConversation && this.conversations.length > 0) {
      this.openExistingConversation(this.conversations[0]._id);
    }
  }

  private startChatPolling() {
    this.stopChatPolling();

    this.chatPollInterval = setInterval(() => {
      this.loadConversations();

      if (this.activeConversation?._id) {
        this.chatService.getConversation(this.activeConversation._id).subscribe({
          next: (conversation) => {
            this.activeConversation = conversation;
            this.syncConversationSummary(conversation);
          }
        });
      }
    }, 5000);
  }

  private stopChatPolling() {
    if (this.chatPollInterval) {
      clearInterval(this.chatPollInterval);
      this.chatPollInterval = null;
    }
  }

  private syncConversationSummary(conversation: any) {
    const lastMessage = conversation.messages?.length
      ? conversation.messages[conversation.messages.length - 1]
      : null;

    const summary = {
      _id: conversation._id,
      publication: conversation.publication,
      participants: conversation.participants,
      updatedAt: conversation.updatedAt,
      lastMessage: lastMessage
        ? {
            _id: lastMessage._id,
            sender: lastMessage.sender,
            text: lastMessage.text,
            createdAt: lastMessage.createdAt,
            hasAttachments: lastMessage.attachments?.length > 0
          }
        : null
    };

    const existingIndex = this.conversations.findIndex((item) => item._id === conversation._id);
    if (existingIndex >= 0) {
      this.conversations.splice(existingIndex, 1, summary);
    } else {
      this.conversations.unshift(summary);
    }

    this.conversations = [...this.conversations].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  }

  private clearSelectedChatFiles() {
    this.selectedChatPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    this.selectedChatFiles = [];
    this.selectedChatPreviews = [];
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
