import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FuncionesAdmin } from './funciones-admin';

describe('FuncionesAdmin', () => {
  let component: FuncionesAdmin;
  let fixture: ComponentFixture<FuncionesAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuncionesAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(FuncionesAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
