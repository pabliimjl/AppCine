import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-candy-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,RouterLink],
  templateUrl: './candy-admin.html',
  styleUrls: ['./candy-admin.scss']
})

export class CandyAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);

  pestanaActiva = signal<string>('productos');

  categorias = signal<any[]>([]);
  productos = signal<any[]>([]);
  combos = signal<any[]>([]);
  
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);

  // Estados para edición
  productoEditandoId = signal<string | null>(null);
  comboEditandoId = signal<string | null>(null);

  productosEnCombo = signal<{ producto_id: string; cantidad: number; nombre: string; precio: number }[]>([]);

  categoriaForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required]
  });

  productoForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    precio: [0, [Validators.required, Validators.min(0)]],
    imagen: ['', Validators.required],
    categoria_id: ['', Validators.required],
    stock: [50, [Validators.required, Validators.min(0)]]
  });

  comboForm: FormGroup = this.fb.group({
    nombre: ['', Validators.required],
    descripcion: ['', Validators.required],
    precio_combo: [0, [Validators.required, Validators.min(0)]],
    imagen: ['', Validators.required],
    producto_temporal: [''],
    cantidad_temporal: [1, [Validators.min(1)]]
  });

  async ngOnInit() {
    await this.cargarDatos();
  }

  async guardarCategoria() {
    if (this.categoriaForm.invalid) return;
    const supabase = (this.supabaseService as any).supabase;
    
    const { error } = await supabase.from('candy_categorias').insert([this.categoriaForm.value]);
    if (error) {
      this.mensajeError.set('Error: ' + error.message);
    } else {
      this.mensajeExito.set('¡Categoría creada correctamente!');
      this.categoriaForm.reset();
      await this.cargarDatos();
    }
  }

  cambiarPestana(pestana: string) {
    this.pestanaActiva.set(pestana);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.cancelarEdicion();
  }

  async cargarDatos() {
    const supabase = (this.supabaseService as any).supabase;

    const [catRes, prodRes, comboRes] = await Promise.all([
      supabase.from('candy_categorias').select('*'),
      supabase.from('candy_productos').select('*, candy_categorias(nombre)'),
      supabase.from('candy_combos').select(`
        *,
        candy_combo_items (
          cantidad,
          producto_id, 
          candy_productos ( nombre, precio )
        )
      `)
    ]);

    if (catRes.data) this.categorias.set(catRes.data);
    if (prodRes.data) this.productos.set(prodRes.data);
    if (comboRes.data) this.combos.set(comboRes.data);
  }

  // --- PRODUCTOS ---
  async guardarProducto() {
    if (this.productoForm.invalid) return;
    const supabase = (this.supabaseService as any).supabase;

    if (this.productoEditandoId()) {
      const { error } = await supabase
        .from('candy_productos')
        .update(this.productoForm.value)
        .eq('id', this.productoEditandoId());

      if (error) {
        this.mensajeError.set('Error al actualizar: ' + error.message);
      } else {
        this.mensajeExito.set('¡Producto actualizado con éxito!');
        this.cancelarEdicion();
        await this.cargarDatos();
      }
    } else {
      const { error } = await supabase.from('candy_productos').insert([this.productoForm.value]);
      if (error) {
        this.mensajeError.set('Error: ' + error.message);
      } else {
        this.mensajeExito.set('¡Producto agregado con éxito!');
        this.productoForm.reset();
        await this.cargarDatos();
      }
    }
  }

  editarProducto(prod: any) {
    this.productoEditandoId.set(prod.id);
    this.productoForm.patchValue({
      nombre: prod.nombre,
      precio: prod.precio,
      imagen: prod.imagen,
      categoria_id: prod.categoria_id,
      stock: prod.stock
    });
  }

  async eliminarProducto(id: string) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    const supabase = (this.supabaseService as any).supabase;
    const { error } = await supabase.from('candy_productos').delete().eq('id', id);
    if (error) this.mensajeError.set('Error al eliminar: ' + error.message);
    else {
      this.mensajeExito.set('Producto eliminado.');
      await this.cargarDatos();
    }
  }

  // --- COMBOS ---
  agregarProductoACombo() {
    const prodId = this.comboForm.get('producto_temporal')?.value;
    const cantidad = Number(this.comboForm.get('cantidad_temporal')?.value || 1);
    if (!prodId) return;

    const productoEncontrado = this.productos().find(p => p.id === prodId);
    if (!productoEncontrado) return;

    this.productosEnCombo.update(items => [
      ...items,
      { producto_id: prodId, cantidad, nombre: productoEncontrado.nombre, precio: productoEncontrado.precio }
    ]);

    this.comboForm.patchValue({ producto_temporal: '', cantidad_temporal: 1 });
  }

  removerProductoDeCombo(index: number) {
    this.productosEnCombo.update(items => items.filter((_, i) => i !== index));
  }

  async guardarCombo() {
    if (this.comboForm.invalid || this.productosEnCombo().length === 0) {
      this.mensajeError.set('Completa los datos del combo y añade al menos un producto.');
      return;
    }

    const supabase = (this.supabaseService as any).supabase;
    this.cargando.set(true);
    this.mensajeError.set(null);

    const { nombre, descripcion, precio_combo, imagen } = this.comboForm.value;

    if (this.comboEditandoId()) {
      // Actualizar combo principal
      const { error: comboError } = await supabase
        .from('candy_combos')
        .update({ nombre, descripcion, precio_combo, imagen })
        .eq('id', this.comboEditandoId());

      if (comboError) {
        this.cargando.set(false);
        this.mensajeError.set('Error al actualizar combo: ' + comboError.message);
        return;
      }

      // Reemplazar ítems: borramos los anteriores y reinsertamos
      await supabase.from('candy_combo_items').delete().eq('combo_id', this.comboEditandoId());
      
      const itemsRelacion = this.productosEnCombo().map(item => ({
        combo_id: this.comboEditandoId(),
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }));

      await supabase.from('candy_combo_items').insert(itemsRelacion);

      this.cargando.set(false);
      this.mensajeExito.set('¡Combo actualizado correctamente!');
      this.cancelarEdicion();
      await this.cargarDatos();

    } else {
      // Crear nuevo combo
      const { data: comboData, error: comboError } = await supabase
        .from('candy_combos')
        .insert([{ nombre, descripcion, precio_combo, imagen }])
        .select()
        .single();

      if (comboError) {
        this.cargando.set(false);
        this.mensajeError.set('Error al crear combo: ' + comboError.message);
        return;
      }

      const itemsRelacion = this.productosEnCombo().map(item => ({
        combo_id: comboData.id,
        producto_id: item.producto_id,
        cantidad: item.cantidad
      }));

      await supabase.from('candy_combo_items').insert(itemsRelacion);

      this.cargando.set(false);
      this.mensajeExito.set('¡Combo creado y vinculado exitosamente!');
      this.comboForm.reset();
      this.productosEnCombo.set([]);
      await this.cargarDatos();
    }
  }

editarCombo(combo: any) {
    this.comboEditandoId.set(combo.id);
    this.comboForm.patchValue({
      nombre: combo.nombre,
      descripcion: combo.descripcion,
      precio_combo: combo.precio_combo,
      imagen: combo.imagen
    });

    // Mapear los ítems existentes asegurando el producto_id
    const itemsMapeados = combo.candy_combo_items.map((i: any) => ({
      producto_id: i.producto_id, // <--- AHORA SE ASIGNA EL ID CORRECTAMENTE
      cantidad: i.cantidad,
      nombre: i.candy_productos?.nombre || 'Producto',
      precio: i.candy_productos?.precio || 0
    }));
    
    this.productosEnCombo.set(itemsMapeados);
  }

  async eliminarCombo(id: string) {
    if (!confirm('¿Estás seguro de eliminar este combo?')) return;
    const supabase = (this.supabaseService as any).supabase;
    const { error } = await supabase.from('candy_combos').delete().eq('id', id);
    if (error) this.mensajeError.set('Error al eliminar: ' + error.message);
    else {
      this.mensajeExito.set('Combo eliminado.');
      await this.cargarDatos();
    }
  }

  cancelarEdicion() {
    this.productoEditandoId.set(null);
    this.comboEditandoId.set(null);
    this.productoForm.reset();
    this.comboForm.reset();
    this.productosEnCombo.set([]);
  }
}