<?php
/**
 * Plugin Name: FPD Dynamic Catalog for Elementor
 * Description: A custom Elementor widget that dynamically generates a product archive catalog overlaying FPD Designs onto FPD Base Products.
 * Version: 1.0.0
 * Author: Digital Sorcerer
 * Text Domain: fpd-elementor-catalog
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

final class FPD_Elementor_Catalog_Plugin {

	const VERSION = '1.0.0';
	const MINIMUM_ELEMENTOR_VERSION = '3.0.0';
	const MINIMUM_PHP_VERSION = '7.4';

	private static $_instance = null;

	public static function instance() {
		if ( is_null( self::$_instance ) ) {
			self::$_instance = new self();
		}
		return self::$_instance;
	}

	public function __construct() {
		add_action( 'plugins_loaded', [ $this, 'init' ] );
	}

	public function init() {
		// Check if Elementor installed and activated
		if ( ! did_action( 'elementor/loaded' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_missing_main_plugin' ] );
			return;
		}

		// Check for required Elementor version
		if ( ! version_compare( ELEMENTOR_VERSION, self::MINIMUM_ELEMENTOR_VERSION, '>=' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_minimum_elementor_version' ] );
			return;
		}

		// Check for required PHP version
		if ( version_compare( PHP_VERSION, self::MINIMUM_PHP_VERSION, '<' ) ) {
			add_action( 'admin_notices', [ $this, 'admin_notice_minimum_php_version' ] );
			return;
		}

		add_action( 'elementor/widgets/register', [ $this, 'init_widgets' ] );
		add_action( 'elementor/frontend/after_enqueue_styles', [ $this, 'widget_styles' ] );
		add_action( 'elementor/frontend/after_enqueue_scripts', [ $this, 'widget_scripts' ] );
	}

	public function admin_notice_missing_main_plugin() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			esc_html__( '"%1$s" requires "%2$s" to be installed and activated.', 'fpd-elementor-catalog' ),
			'<strong>' . esc_html__( 'FPD Dynamic Catalog', 'fpd-elementor-catalog' ) . '</strong>',
			'<strong>' . esc_html__( 'Elementor', 'fpd-elementor-catalog' ) . '</strong>'
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function admin_notice_minimum_elementor_version() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'fpd-elementor-catalog' ),
			'<strong>' . esc_html__( 'FPD Dynamic Catalog', 'fpd-elementor-catalog' ) . '</strong>',
			'<strong>' . esc_html__( 'Elementor', 'fpd-elementor-catalog' ) . '</strong>',
			 self::MINIMUM_ELEMENTOR_VERSION
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function admin_notice_minimum_php_version() {
		if ( isset( $_GET['activate'] ) ) unset( $_GET['activate'] );
		$message = sprintf(
			esc_html__( '"%1$s" requires "%2$s" version %3$s or greater.', 'fpd-elementor-catalog' ),
			'<strong>' . esc_html__( 'FPD Dynamic Catalog', 'fpd-elementor-catalog' ) . '</strong>',
			'<strong>' . esc_html__( 'PHP', 'fpd-elementor-catalog' ) . '</strong>',
			 self::MINIMUM_PHP_VERSION
		);
		printf( '<div class="notice notice-warning is-dismissible"><p>%1$s</p></div>', $message );
	}

	public function init_widgets( $widgets_manager ) {
		require_once( __DIR__ . '/includes/widget-fpd-catalog.php' );
		
		if ( method_exists( $widgets_manager, 'register' ) ) {
			$widgets_manager->register( new \FPD_Elementor_Catalog_Widget() );
		} else {
			$widgets_manager->register_widget_type( new \FPD_Elementor_Catalog_Widget() );
		}
	}

	public function widget_styles() {
		wp_enqueue_style( 'fpd-catalog-style', plugins_url( 'assets/css/fpd-catalog.css', __FILE__ ), [], self::VERSION );
	}

	public function widget_scripts() {
		wp_enqueue_script( 'fpd-catalog-script', plugins_url( 'assets/js/fpd-catalog.js', __FILE__ ), [ 'jquery' ], self::VERSION, true );
	}
}

FPD_Elementor_Catalog_Plugin::instance();
