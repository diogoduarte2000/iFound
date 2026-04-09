import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PublicationService } from '../../services/publication.service';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';
import { DeviceService, IphoneCatalogItem, ImeiValidationResponse } from '../../services/device.service';
import { PORTUGAL_LOCATIONS } from '../../shared/portugal-locations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  publications: any[] = [];
  conversations: any[] = [];
  viewMode: 'list' | 'create' = 'list';
  filterType: 'Todos' | 'Perdido' | 'Achado' = 'Todos';
  filterStatus: 'Todos' | 'Ativo' | 'Pendente' = 'Todos';
  selectedZone = '';
  searchQuery = '';
  currentUserId = '';

  pubForm: FormGroup;
  hasAttemptedSubmit = false;
  isLoading = false;
  isFeedLoading = false;
  isConversationLoading = false;
  isEditingPublication = false;
  isPreparingEdit = false;
  editingPublicationId = '';
  message = '';
  conversationError = '';
  photoPreview: string | null = null;
  photoError = '';
  catalogError = '';
  catalogSourceUrl = '';
  catalogSyncedAt = '';
  imeiValidationMessage = '';
  imeiValidationState: 'idle' | 'checking' | 'valid' | 'invalid' = 'idle';
  iphoneCatalog: IphoneCatalogItem[] = [];
  availableColors: string[] = [];
  availableStorages: string[] = [];

  readonly locationOptions = PORTUGAL_LOCATIONS;

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private pubService: PublicationService,
    private authService: AuthService,
    private chatService: ChatService,
    private deviceService: DeviceService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.pubForm = this.fb.group({
      type: ['Perdido', Validators.required],
      model: ['', Validators.required],
      color: ['', Validators.required],
      storage: [''],
      imei: [''],
      distinctiveMarks: [''],
      zone: ['', Validators.required],
      exactLocation: [''],
      dateOfEvent: ['', Validators.required],
      photo: [null, Validators.required]
    });

    this.pubForm.get('model')?.valueChanges.subscribe((model) => {
      this.syncVariantOptions(String(model || ''));
    });

    this.pubForm.get('imei')?.valueChanges.subscribe((value) => {
      const normalizedImei = String(value || '').replace(/\D/g, '').slice(0, 15);

      if (String(value || '') !== normalizedImei) {
        this.pubForm.patchValue({ imei: normalizedImei }, { emitEvent: false });
      }

      this.imeiValidationState = 'idle';
      this.imeiValidationMessage = '';
    });
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUserId = this.authService.getCurrentUser()?.id || '';
    this.loadIphoneCatalog();
    this.loadPublications();
    this.loadConversations();

    this.route.queryParamMap.subscribe((params) => {
      const editId = params.get('editId');

      if (editId) {
        this.loadPublicationForEditing(editId);
        return;
      }

      if (this.isEditingPublication || this.isPreparingEdit) {
        this.clearEditState();
      }
    });
  }

  ngOnDestroy() {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setFeedView() {
    this.viewMode = 'list';
  }

  setCreateView() {
    this.viewMode = 'create';
    this.message = '';

    if (this.isEditingPublication || this.isPreparingEdit) {
      this.clearEditState();
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { editId: null },
        queryParamsHandling: 'merge'
      });
      return;
    }

    this.resetPublicationForm();
  }

  cancelEditMode() {
    this.clearEditState();
    this.router.navigate(['/minhas-publicacoes']);
  }

  openChatsPage() {
    this.router.navigate(['/conversas']);
  }

  setFilter(type: 'Todos' | 'Perdido' | 'Achado') {
    this.filterType = type;
    this.loadPublications();
  }

  setStatus(status: 'Todos' | 'Ativo' | 'Pendente') {
    this.filterStatus = status;
    this.loadPublications();
  }

  onFileSelected(event: any) {
    this.photoError = '';
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      this.photoError = 'Formato invalido. Apenas JPG ou PNG.';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.photoError = 'Imagem muito grande. O limite e 2MB.';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const resizedB64 = canvas.toDataURL('image/jpeg', 0.8);
        this.photoPreview = resizedB64;
        this.pubForm.patchValue({ photo: resizedB64 });
        this.pubForm.get('photo')?.markAsTouched();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  onZoneChange(zone: string) {
    this.selectedZone = zone;
    this.loadPublications();
  }

  onSearchInput(value: string) {
    this.searchQuery = value;

    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }

    this.searchDebounce = setTimeout(() => {
      this.loadPublications();
    }, 250);
  }

  clearSearch() {
    this.searchQuery = '';
    this.loadPublications();
  }

  loadPublications() {
    this.isFeedLoading = true;

    const filters = {
      type: this.filterType === 'Todos' ? undefined : this.filterType,
      status: this.filterStatus === 'Todos' ? undefined : this.filterStatus,
      zone: this.selectedZone || undefined,
      q: this.searchQuery.trim() || undefined
    };

    this.pubService.getPublications(filters).subscribe({
      next: (data) => {
        this.publications = data;
        this.isFeedLoading = false;
      },
      error: () => {
        this.isFeedLoading = false;
      }
    });
  }

  loadConversations() {
    this.isConversationLoading = true;
    this.conversationError = '';

    this.chatService.getConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        this.isConversationLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isConversationLoading = false;
        this.conversationError = err.error?.message || 'Nao foi possivel carregar as conversas.';
      }
    });
  }

  loadIphoneCatalog() {
    this.catalogError = '';

    this.deviceService.getIphoneCatalog().subscribe({
      next: (response) => {
        this.iphoneCatalog = response.devices;
        this.catalogSourceUrl = response.sourceUrl;
        this.catalogSyncedAt = response.syncedAt;
        this.syncVariantOptions(String(this.pubForm.get('model')?.value || ''));
      },
      error: () => {
        this.catalogError = 'Nao foi possivel carregar o catalogo Apple.';
      }
    });
  }

  validateImei() {
    const imei = String(this.pubForm.get('imei')?.value || '').trim();
    const model = String(this.pubForm.get('model')?.value || '').trim();

    if (!imei) {
      this.imeiValidationState = 'idle';
      this.imeiValidationMessage = '';
      return;
    }

    if (!/^\d{15}$/.test(imei)) {
      this.imeiValidationState = 'invalid';
      this.imeiValidationMessage = 'O IMEI deve ter exatamente 15 digitos numericos.';
      return;
    }

    this.imeiValidationState = 'checking';
    this.imeiValidationMessage = 'A validar IMEI...';

    this.deviceService.validateImei(imei, model || undefined).subscribe({
      next: (response) => {
        this.applyImeiValidationResult(response);
      },
      error: (err: HttpErrorResponse) => {
        const response = err.error as Partial<ImeiValidationResponse> | undefined;
        this.imeiValidationState = 'invalid';
        this.imeiValidationMessage = response?.reason || 'Nao foi possivel validar o IMEI.';
      }
    });
  }

  onSubmitPublication() {
    this.hasAttemptedSubmit = true;
    const imei = String(this.pubForm.get('imei')?.value || '').trim();

    if (imei && !/^\d{15}$/.test(imei)) {
      this.message = 'O IMEI deve ter exatamente 15 digitos numericos.';
      this.imeiValidationState = 'invalid';
      this.imeiValidationMessage = this.message;
      return;
    }

    if (this.pubForm.invalid) {
      this.pubForm.markAllAsTouched();
      this.message = `Falta preencher: ${this.getMissingRequiredFields().join(', ')}.`;
      return;
    }

    if (this.pubForm.value.imei && this.imeiValidationState === 'invalid') {
      this.message = this.imeiValidationMessage || 'O IMEI introduzido nao e valido.';
      return;
    }

    this.isLoading = true;
    this.message = '';

    const payload = this.pubForm.value;
    const request$ = this.isEditingPublication && this.editingPublicationId
      ? this.pubService.updatePublication(this.editingPublicationId, payload)
      : this.pubService.createPublication(payload);

    request$.subscribe({
      next: () => {
        this.isLoading = false;

        if (this.isEditingPublication) {
          this.clearEditState();
          this.loadPublications();
          this.router.navigate(['/minhas-publicacoes']);
          return;
        }

        this.viewMode = 'list';
        this.resetPublicationForm();
        this.loadPublications();
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;

        if (err.status === 401 || err.status === 400) {
          const backendMessage = err.error?.message || '';
          if (backendMessage.toLowerCase().includes('token')) {
            this.authService.logout();
            this.router.navigate(['/login']);
            return;
          }
        }

        if (err.status === 0) {
          this.message = 'Nao foi possivel ligar ao backend. Confirme se o servidor esta a correr na porta 5000.';
          return;
        }

        this.message = err.error?.message || (this.isEditingPublication ? 'Erro ao editar publicacao.' : 'Erro ao criar publicacao.');
      }
    });
  }

  isFieldInvalid(fieldName: string) {
    const control = this.pubForm.get(fieldName);
    return !!control && control.invalid && (control.touched || this.hasAttemptedSubmit);
  }

  isOwnPublication(publication: any) {
    return publication?.author?._id === this.currentUserId;
  }

  openChat(publication: any) {
    this.router.navigate(['/conversas'], {
      queryParams: { publicationId: publication._id }
    });
  }

  openOwnPublicationChats(publication: any) {
    this.router.navigate(['/conversas'], {
      queryParams: {
        publicationId: publication._id,
        ownerView: '1'
      }
    });
  }

  openExistingConversation(conversationId: string) {
    this.router.navigate(['/conversas'], {
      queryParams: { chatId: conversationId }
    });
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

  private loadPublicationForEditing(publicationId: string) {
    if (this.editingPublicationId === publicationId && this.isEditingPublication) {
      this.viewMode = 'create';
      return;
    }

    this.isPreparingEdit = true;
    this.viewMode = 'create';
    this.message = 'A carregar anuncio para edicao...';

    this.pubService.getMyPublication(publicationId).subscribe({
      next: (publication) => {
        this.isPreparingEdit = false;
        this.isEditingPublication = true;
        this.editingPublicationId = publication._id;
        this.applyPublicationToForm(publication);
        this.message = '';
      },
      error: (err: HttpErrorResponse) => {
        this.isPreparingEdit = false;
        this.message = err.error?.message || 'Nao foi possivel abrir este anuncio para edicao.';
        this.viewMode = 'list';
      }
    });
  }

  private applyPublicationToForm(publication: any) {
    this.photoPreview = publication.photo || null;
    this.pubForm.reset({
      type: publication.type || 'Perdido',
      model: publication.model || '',
      color: publication.color || '',
      storage: publication.storage || '',
      imei: publication.imei || '',
      distinctiveMarks: publication.distinctiveMarks || '',
      zone: publication.zone || '',
      exactLocation: publication.exactLocation || '',
      dateOfEvent: publication.dateOfEvent ? new Date(publication.dateOfEvent).toISOString().slice(0, 10) : '',
      photo: publication.photo || null,
    });
    this.hasAttemptedSubmit = false;
    this.photoError = '';
    this.imeiValidationState = 'idle';
    this.imeiValidationMessage = '';
    this.syncVariantOptions(String(publication.model || ''));
  }

  private clearEditState() {
    this.isEditingPublication = false;
    this.isPreparingEdit = false;
    this.editingPublicationId = '';
    this.message = '';
    this.resetPublicationForm();
  }

  private resetPublicationForm() {
    this.pubForm.reset({
      type: 'Perdido',
      model: '',
      color: '',
      storage: '',
      imei: '',
      distinctiveMarks: '',
      zone: '',
      exactLocation: '',
      dateOfEvent: '',
      photo: null,
    });
    this.photoPreview = null;
    this.photoError = '';
    this.hasAttemptedSubmit = false;
    this.imeiValidationState = 'idle';
    this.imeiValidationMessage = '';
    this.syncVariantOptions('');
  }

  private syncVariantOptions(model: string) {
    const selectedModel = this.iphoneCatalog.find((item) => item.model === model);

    this.availableColors = selectedModel?.colors ?? [];
    this.availableStorages = selectedModel?.storages ?? [];

    const selectedColor = String(this.pubForm.get('color')?.value || '');
    if (selectedColor && !this.availableColors.includes(selectedColor)) {
      this.pubForm.patchValue({ color: '' }, { emitEvent: false });
    }

    const selectedStorage = String(this.pubForm.get('storage')?.value || '');
    if (selectedStorage && !this.availableStorages.includes(selectedStorage)) {
      this.pubForm.patchValue({ storage: '' }, { emitEvent: false });
    }
  }

  private applyImeiValidationResult(response: ImeiValidationResponse) {
    this.imeiValidationState = response.isValid ? 'valid' : 'invalid';
    this.imeiValidationMessage = response.isValid
      ? 'IMEI valido com 15 digitos numericos. A verificacao de existencia externa ainda nao esta configurada.'
      : response.reason;
  }

  private getMissingRequiredFields() {
    const labels: Record<string, string> = {
      type: 'tipo de ocorrencia',
      model: 'modelo',
      color: 'cor',
      zone: 'localidade',
      dateOfEvent: 'data da ocorrencia',
      photo: 'fotografia'
    };

    return Object.entries(labels)
      .filter(([fieldName]) => this.pubForm.get(fieldName)?.hasError('required'))
      .map(([, label]) => label);
  }
}
