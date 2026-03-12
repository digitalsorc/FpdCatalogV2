<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

class FPD_Elementor_Catalog_Widget extends \Elementor\Widget_Base {

	public function get_name() {
		return 'fpd_dynamic_catalog';
	}

	public function get_title() {
		return esc_html__( 'FPD Catalog V2', 'fpd-elementor-catalog' );
	}

	public function get_icon() {
		return 'eicon-products';
	}

	public function get_categories() {
		return [ 'general' ];
	}

	public function get_script_depends() {
		return [ 'fpd-catalog-script' ];
	}

	public function get_style_depends() {
		return [ 'fpd-catalog-style' ];
	}

	protected function register_controls() {

		$this->start_controls_section(
			'content_section',
			[
				'label' => esc_html__( 'Catalog Settings', 'fpd-elementor-catalog' ),
				'tab' => \Elementor\Controls_Manager::TAB_CONTENT,
			]
		);

		$this->add_control(
			'source_type',
			[
				'label' => esc_html__( 'Source', 'fpd-elementor-catalog' ),
				'type' => \Elementor\Controls_Manager::SELECT,
				'default' => 'designs',
				'options' => [
					'designs'  => esc_html__( 'FPD Designs', 'fpd-elementor-catalog' ),
					'products' => esc_html__( 'FPD Products', 'fpd-elementor-catalog' ),
				],
			]
		);

		$this->add_control(
			'fpd_design_category',
			[
				'label' => esc_html__( 'Design Category', 'fpd-elementor-catalog' ),
				'type' => \Elementor\Controls_Manager::SELECT2,
				'options' => $this->get_fpd_design_categories(),
				'condition' => [
					'source_type' => 'designs',
				],
				'multiple' => true,
			]
		);

		$this->add_control(
			'base_product_override',
			[
				'label' => esc_html__( 'Base Product Override', 'fpd-elementor-catalog' ),
				'type' => \Elementor\Controls_Manager::SELECT2,
				'options' => $this->get_fpd_products(),
				'description' => esc_html__( 'Force a specific FPD Base Product as the background.', 'fpd-elementor-catalog' ),
			]
		);

		$this->add_control(
			'auto_calculate_box',
			[
				'label' => esc_html__( 'Auto-Calculate Printing Box', 'fpd-elementor-catalog' ),
				'type' => \Elementor\Controls_Manager::SWITCHER,
				'label_on' => esc_html__( 'Yes', 'fpd-elementor-catalog' ),
				'label_off' => esc_html__( 'No', 'fpd-elementor-catalog' ),
				'return_value' => 'yes',
				'default' => 'yes',
			]
		);

		$this->end_controls_section();
	}

	// For Elementor < 3.1.0 backward compatibility
	protected function _register_controls() {
		$this->register_controls();
	}

	private function get_fpd_design_categories() {
		$options = [];
		
		// 1. Try taxonomy first (Standard FPD behavior for designs)
		$terms = get_terms( [
			'taxonomy' => 'fpd_design_category',
			'hide_empty' => false,
		] );
		
		if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
			foreach ( $terms as $term ) {
				$options[ 'tax_' . $term->term_id ] = 'Taxonomy: ' . $term->name;
			}
		}
		
		// 2. Try custom table (Some FPD versions/addons)
		global $wpdb;
		$table = $wpdb->prefix . 'fpd_categories';
		$suppress = $wpdb->suppress_errors();
		$results = $wpdb->get_results( "SELECT ID, title FROM $table ORDER BY title ASC" );
		$wpdb->suppress_errors( $suppress );
		
		if ( ! empty( $results ) && ! is_wp_error( $results ) ) {
			foreach ( $results as $result ) {
				$id = $result->ID ?? $result->id ?? null;
				$title = $result->title ?? '';
				if ( $id ) {
					$options[ 'db_' . $id ] = 'DB: ' . $title;
				}
			}
		}
		
		return $options;
	}

	private function get_fpd_products() {
		global $wpdb;
		$table = $wpdb->prefix . 'fpd_products';
		$options = [ '' => esc_html__( 'Default', 'fpd-elementor-catalog' ) ];
		
		$suppress = $wpdb->suppress_errors();
		$results = $wpdb->get_results( "SELECT ID, title FROM $table ORDER BY title ASC" );
		$wpdb->suppress_errors( $suppress );
		
		if ( ! empty( $results ) && ! is_wp_error( $results ) ) {
			foreach ( $results as $result ) {
				$id = $result->ID ?? $result->id ?? null;
				$title = $result->title ?? '';
				if ( $id ) {
					$options[ $id ] = $title;
				}
			}
		}
		return $options;
	}

	private function get_fpd_views($product_id) {
		global $wpdb;
		$table = $wpdb->prefix . 'fpd_views';
		
		$suppress = $wpdb->suppress_errors();
		$query = $wpdb->prepare("SELECT * FROM $table WHERE product_id = %d ORDER BY view_order ASC LIMIT 1", intval($product_id));
		$result = $wpdb->get_row($query);
		$wpdb->suppress_errors( $suppress );
		
		return ( ! empty( $result ) && ! is_wp_error( $result ) ) ? $result : null;
	}

	private function get_fpd_products_data() {
		global $wpdb;
		$table = $wpdb->prefix . 'fpd_products';
		$suppress = $wpdb->suppress_errors();
		$results = $wpdb->get_results( "SELECT ID, title, thumbnail FROM $table ORDER BY title ASC" );
		$wpdb->suppress_errors( $suppress );
		
		$products = [];
		if ( ! empty( $results ) && ! is_wp_error( $results ) ) {
			foreach ( $results as $result ) {
				$view = $this->get_fpd_views($result->ID);
				$image = '';
				
				// Try to get image from view elements
				if ($view) {
					$elements = json_decode($view->elements, true);
					if (is_array($elements)) {
						foreach ($elements as $element) {
							if (isset($element['type']) && $element['type'] === 'image' && isset($element['source'])) {
								$image = $element['source'];
								break;
							}
						}
					}
					// Fallback to view thumbnail
					if (empty($image) && isset($view->thumbnail)) {
						$image = $view->thumbnail;
					}
				}
				
				// Fallback to product thumbnail
				if (empty($image) && isset($result->thumbnail)) {
					$image = $result->thumbnail;
				}
				
				$products[] = (object) [
					'ID' => $result->ID,
					'title' => $result->title,
					'image' => $image
				];
			}
		}
		return $products;
	}

	private function get_fpd_designs($category_ids = []) {
		$designs = [];
		$category_ids = (array) $category_ids;
		
		$tax_ids = [];
		$db_ids = [];
		
		// Handle $_GET filtering safely
		if ( isset($_GET['design_cat']) && !empty($_GET['design_cat']) ) {
			$cat_id = sanitize_text_field($_GET['design_cat']);
			$category_ids = [$cat_id];
		}

		foreach ($category_ids as $cid) {
			if (strpos($cid, 'tax_') === 0) {
				$tax_ids[] = intval(substr($cid, 4));
			} elseif (strpos($cid, 'db_') === 0) {
				$db_ids[] = intval(substr($cid, 3));
			} else {
				$db_ids[] = intval($cid);
			}
		}
		
		// 1. Fetch from Taxonomy (Standard WP Attachments)
		if ( !empty($tax_ids) || empty($category_ids) ) {
			$args = [
				'post_type'      => 'attachment',
				'post_status'    => 'inherit',
				'posts_per_page' => -1,
			];
			if ( !empty($tax_ids) ) {
				$args['tax_query'] = [
					[
						'taxonomy' => 'fpd_design_category',
						'field'    => 'term_id',
						'terms'    => $tax_ids,
					],
				];
			} else {
				$args['tax_query'] = [
					[
						'taxonomy' => 'fpd_design_category',
						'operator' => 'EXISTS',
					],
				];
			}
			
			$query = new \WP_Query( $args );
			if ( $query->have_posts() ) {
				foreach ( $query->posts as $post ) {
					$designs[] = (object) [
						'ID'    => $post->ID,
						'title' => $post->post_title,
						'image' => wp_get_attachment_url( $post->ID ),
					];
				}
			}
		}
		
		// 2. Fetch from DB (Custom Tables)
		global $wpdb;
		$table_designs = $wpdb->prefix . 'fpd_designs';
		$table_category_designs = $wpdb->prefix . 'fpd_category_designs';
		
		$suppress = $wpdb->suppress_errors();
		$check = $wpdb->get_results("SHOW TABLES LIKE '$table_designs'");
		if ( !empty($check) ) {
			if ( !empty($db_ids) ) {
				$cat_ids_str = implode(',', array_map('intval', $db_ids));
				$query = "SELECT d.* FROM $table_designs d INNER JOIN $table_category_designs cd ON d.ID = cd.design_id WHERE cd.category_id IN ($cat_ids_str)";
			} else {
				$query = "SELECT * FROM $table_designs";
			}
			
			$args = apply_filters('fpd_dynamic_catalog_query_args', [
				'query' => $query,
				'category_ids' => $db_ids
			]);

			$results = $wpdb->get_results($args['query']);
			if ( ! empty( $results ) && ! is_wp_error( $results ) ) {
				foreach ($results as $res) {
					$designs[] = $res;
				}
			}
		}
		$wpdb->suppress_errors( $suppress );

		// 3. Fallback: Check fpd_designs_parameter in wp_options
		if (empty($designs)) {
			$fpd_designs_param = get_option('fpd_designs_parameter', '');
			if (!empty($fpd_designs_param)) {
				$designs_json = json_decode($fpd_designs_param, true);
				if (is_array($designs_json)) {
					foreach ($designs_json as $category => $category_designs) {
						if (is_array($category_designs)) {
							foreach ($category_designs as $design) {
								$image_url = is_array($design) && isset($design['url']) ? $design['url'] : (is_string($design) ? $design : '');
								$title = is_array($design) && isset($design['title']) ? $design['title'] : basename($image_url);
								if (!empty($image_url)) {
									$designs[] = (object) [
										'ID' => md5($image_url),
										'title' => $title,
										'image' => $image_url
									];
								}
							}
						}
					}
				}
			}
		}
		
		return $designs;
	}

	protected function render() {
		$settings = $this->get_settings_for_display();
		$source_type = isset($settings['source_type']) ? $settings['source_type'] : 'designs';
		$base_product_id = isset($settings['base_product_override']) ? $settings['base_product_override'] : '';
		$auto_calc = isset($settings['auto_calculate_box']) ? $settings['auto_calculate_box'] === 'yes' : true;

		$items = [];

		if ( $source_type === 'designs' ) {
			$cat_ids = !empty($settings['fpd_design_category']) ? $settings['fpd_design_category'] : [];
			$items = $this->get_fpd_designs($cat_ids);
		} elseif ( $source_type === 'products' ) {
			$items = $this->get_fpd_products_data();
		}

		if ( empty($items) ) {
			echo '<p>' . esc_html__( 'No items found.', 'fpd-elementor-catalog' ) . '</p>';
			echo '<!-- Debug: Source: ' . esc_html($source_type) . ' -->';
			return;
		}

		// Fetch Base Product View
		$base_view = null;
		$base_image = '';
		$print_box = [
			'left' => 0,
			'top' => 0,
			'width' => 100,
			'height' => 100,
			'unit' => '%'
		];

		if ( !empty($base_product_id) ) {
			$base_view = $this->get_fpd_views($base_product_id);
			if ( $base_view ) {
				$elements = json_decode($base_view->elements, true);
				if ( is_array($elements) ) {
					foreach ( $elements as $element ) {
						if ( isset($element['type']) && $element['type'] === 'image' && isset($element['source']) ) {
							$base_image = $element['source'];
							// Assuming the first image is the base
							break;
						}
					}
					
					if ( $auto_calc ) {
						// Look for bounding box or printing box in elements
						foreach ( $elements as $element ) {
							if ( isset($element['parameters']['boundingBox']) ) {
								$bbox = $element['parameters']['boundingBox'];
								if (isset($element['parameters']['left'])) $print_box['left'] = $element['parameters']['left'];
								if (isset($element['parameters']['top'])) $print_box['top'] = $element['parameters']['top'];
								if (isset($element['parameters']['width'])) $print_box['width'] = $element['parameters']['width'];
								if (isset($element['parameters']['height'])) $print_box['height'] = $element['parameters']['height'];
								$print_box['unit'] = 'px';
								break;
							}
						}
					}
				}
			}
		}

		echo '<div class="fpd-catalog-grid">';

		foreach ( $items as $item ) {
			$design_image = isset($item->image) ? $item->image : ''; 
			$design_title = isset($item->title) ? $item->title : '';

			// If no image, skip
			if ( empty($design_image) ) continue;

			echo '<div class="fpd-catalog-item">';
			
			// Base Layer
			if ( !empty($base_image) ) {
				echo '<img src="' . esc_url($base_image) . '" class="fpd-base-layer" alt="Base Product" />';
			} else {
				echo '<div class="fpd-base-layer-placeholder"></div>';
			}

			// Design Layer
			$style = '';
			if ( $auto_calc && $print_box['unit'] === 'px' ) {
				$style = sprintf(
					'left: 50%%; transform: translateX(-50%%); top: %s; max-width: %s;',
					esc_attr($print_box['top'] . $print_box['unit']),
					esc_attr($print_box['width'] . $print_box['unit'])
				);
			} else {
				$style = 'left: 50%; transform: translateX(-50%); top: 0; max-width: 100%;';
			}

			echo '<div class="fpd-design-layer-wrapper" style="' . $style . '">';
			echo '<img src="' . esc_url($design_image) . '" class="fpd-design-layer" alt="' . esc_attr($design_title) . '" />';
			echo '</div>'; // .fpd-design-layer-wrapper

			echo '<h3 class="fpd-item-title">' . esc_html($design_title) . '</h3>';
			
			echo '</div>'; // .fpd-catalog-item
		}

		echo '</div>'; // .fpd-catalog-grid
	}
}
