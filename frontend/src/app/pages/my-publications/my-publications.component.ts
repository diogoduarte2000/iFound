import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PublicationService } from '../../services/publication.service';

@Component({
  selector: 'app-my-publications',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-publications.component.html',
  styleUrls: ['./my-publications.component.scss']
})
export class MyPublicationsComponent implements OnInit, OnDestroy {
  publications: any[] = [];
  isLoading = false;
  message = '';
  updatingPublicationId = '';
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private publicationService: PublicationService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadPublications();
    this.refreshInterval = setInterval(() => this.loadPublications(true), 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  loadPublications(silent = false) {
    if (!silent) {
      this.isLoading = true;
      this.message = '';
    }

    this.publicationService.getMyPublications().subscribe({
      next: (data) => {
        this.publications = data;
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.message = err.error?.message || 'Nao foi possivel carregar as suas publicacoes.';
      }
    });
  }

  editPublication(publication: any) {
    if (!this.canEditPublication(publication)) {
      return;
    }

    this.router.navigate(['/dashboard'], {
      queryParams: { editId: publication._id }
    });
  }

  updateStatus(publication: any, status: 'Ativo' | 'Pendente' | 'Resolvido') {
    if (publication.status === 'Offline' || publication.status === 'Resolvido' || this.updatingPublicationId === publication._id) {
      return;
    }

    this.updatingPublicationId = publication._id;
    this.message = '';

    this.publicationService.updatePublicationStatus(publication._id, status).subscribe({
      next: (response: any) => {
        const updatedDoc = response.publication;
        const index = this.publications.findIndex(p => p._id === updatedDoc._id);
        if (index > -1) {
          this.publications[index] = updatedDoc;
          this.publications = [...this.publications];
        }
        this.updatingPublicationId = '';
        this.message = `Mudanca aplicada e guardada! Novo estado: ${updatedDoc.status}.`;

        setTimeout(() => {
          if (this.message.startsWith('Mudanca aplicada')) {
            this.message = '';
          }
        }, 5000);
      },
      error: (err: HttpErrorResponse) => {
        this.updatingPublicationId = '';
        this.message = err.error?.message || 'Nao foi possivel atualizar o estado da publicacao.';
      }
    });
  }

  canEditPublication(publication: any) {
    return publication?.status !== 'Offline' && publication?.status !== 'Resolvido';
  }

  getOnlineCount() {
    return this.publications.filter((publication) => ['Ativo', 'Pendente'].includes(publication.status)).length;
  }

  getOnlineUntil(publication: any) {
    return new Date(new Date(publication.createdAt).getTime() + 90 * 24 * 60 * 60 * 1000);
  }

  getPendingUntil(publication: any) {
    if (!publication.pendingSince) {
      return null;
    }

    return new Date(new Date(publication.pendingSince).getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  getResolvedUntil(publication: any) {
    if (!publication.resolvedAt) {
      return null;
    }

    return new Date(new Date(publication.resolvedAt).getTime() + 5 * 60 * 1000);
  }

  getStatusClasses(status: string) {
    if (status === 'Ativo') {
      return 'bg-amber-100 text-amber-700';
    }

    if (status === 'Pendente') {
      return 'bg-cyan-100 text-cyan-700';
    }

    if (status === 'Resolvido') {
      return 'bg-emerald-100 text-emerald-700';
    }

    return 'bg-slate-200 text-slate-700';
  }
}
