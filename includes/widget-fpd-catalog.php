<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

class FPD_Elementor_Catalog_Widget extends \Elementor\Widget_Base {

	public function get_name() {
		return 'fpd_dynamic_catalog';
	}

	public function get_title() {
		return esc_html__( 'FPD Dynamic Catalog', 'fpd-elementor-catalog' );
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
				'options' => $this->get_fpd_categories('fpd_categories'),
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

	private function get_fpd_categories($type = 'fpd_categories') {
		global $wpdb;
		$table = $wpdb->prefix . $type;
		$options = [];
		
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

	private function get_fpd_designs($category_ids = []) {
		global $wpdb;
		$table_designs = $wpdb->prefix . 'fpd_designs';
		$table_category_designs = $wpdb->prefix . 'fpd_category_designs';
		
		$designs = [];
		$category_ids = (array) $category_ids;
		
		// Handle $_GET filtering safely
		if ( isset($_GET['design_cat']) && !empty($_GET['design_cat']) ) {
			$cat_id = intval($_GET['design_cat']);
			$category_ids = [$cat_id];
		}

		$suppress = $wpdb->suppress_errors();

		if ( !empty($category_ids) ) {
			$cat_ids_str = implode(',', array_map('intval', $category_ids));
			$query = "SELECT d.* FROM $table_designs d INNER JOIN $table_category_designs cd ON d.ID = cd.design_id WHERE cd.category_id IN ($cat_ids_str)";
		} else {
			$query = "SELECT * FROM $table_designs";
		}

		// Apply external filters
		$args = apply_filters('fpd_dynamic_catalog_query_args', [
			'query' => $query,
			'category_ids' => $category_ids
		]);

		$results = $wpdb->get_results($args['query']);
		$wpdb->suppress_errors( $suppress );
		
		if ( ! empty( $results ) && ! is_wp_error( $results ) ) {
			$designs = $results;
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
		}

		if ( empty($items) ) {
			echo '<p>' . esc_html__( 'No items found.', 'fpd-elementor-catalog' ) . '</p>';
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
								// Bounding box could be another element or coordinates
								// Simplified extraction assuming coordinates are available
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
			$design_image = isset($item->image) ? $item->image : ''; // Adjust based on actual FPD schema
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
				// We need to convert px to % based on base image natural size, or use absolute positioning if container is relative
				// For simplicity, outputting inline styles
				$style = sprintf(
					'left: 50%%; transform: translateX(-50%%); top: %s; max-width: %s;',
					esc_attr($print_box['top'] . $print_box['unit']),
					esc_attr($print_box['width'] . $print_box['unit'])
				);
			} else {
				// Default positioning
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
